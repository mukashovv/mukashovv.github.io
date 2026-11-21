import { layouts, renderFeature } from "../build/js/home-feature.js";

const form = document.querySelector("#feature-form");
const notice = document.querySelector("#feature-status");
const frame = form.querySelector("iframe");
const { layout, lang, title, description, cta } = form.elements;
const fields = [title, description, cta];
const photoInputs = [...form.querySelectorAll("[data-photo]")];
const pending = new Map();
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let version = 0;
let drafts;
let templates;
let client;
let active;
let saving = false;

for (const [key, design] of Object.entries(layouts)) layout.add(new Option(design.label, key));

export function resetEditor() {
    version++;
    for (const entry of pending.values()) URL.revokeObjectURL(entry.preview);
    pending.clear();
    form.inert = false;
    form.hidden = true;
    form.reset();
    drafts = null;
    client = null;
    saving = false;
    form.querySelector("button").disabled = false;
    notice.textContent = "";
    frame.contentDocument?.body?.replaceChildren();
}

function preview() {
    const doc = frame.contentDocument;
    if (!doc?.body || !drafts) return;
    const section = doc.importNode(templates[lang.value], true);
    section.hidden = false;
    renderFeature(section, layout.value, drafts[layout.value], lang.value,
        photoInputs.map(input => pending.get(layout.value + input.dataset.photo)?.preview));
    doc.documentElement.lang = lang.value;
    doc.body.replaceChildren(section);
}

for (const input of photoInputs) input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    input.value = "";
    if (!extensions[file.type] || !file.size || file.size > 10 * 1024 * 1024) {
        notice.textContent = "Выберите фото JPEG, PNG или WebP размером до 10 МБ.";
        return;
    }
    const id = layout.value + input.dataset.photo;
    const old = pending.get(id);
    if (old) URL.revokeObjectURL(old.preview);
    pending.set(id, { file, preview: URL.createObjectURL(file) });
    notice.textContent = "Фото в предпросмотре. Нажмите «Сохранить и опубликовать», чтобы показать его на сайте.";
    preview();
});

function showSelection() {
    photoInputs[1].closest("label").hidden = layout.value === "panorama";
    fields.forEach((field, i) => {
        field.value = drafts[layout.value][lang.value][i];
    });
    notice.textContent = "Сейчас на сайте — «" + layouts[active].label + "».";
    preview();
}

async function template(language) {
    const path = language === "ru" ? "/prints/" : "/prints/en/";
    const response = await fetch(path);
    if (!response.ok) throw new Error("Preview unavailable");
    const html = new DOMParser().parseFromString(await response.text(), "text/html");
    const section = html.querySelector("[data-gallery-feature]");
    if (!section) throw new Error("Missing feature");
    return section;
}

export async function loadEditor(account) {
    const current = version;
    notice.textContent = "Загружаем варианты…";
    try {
        const [result, ru, en] = await Promise.all([
            account.rpc("prints_manage_home_feature"), template("ru"), template("en")
        ]);
        if (current !== version) return;
        if (result.error) throw result.error;
        const settings = {};
        for (const row of result.data) {
            settings[row.layout] = { photos: row.copy?.photos || [] };
            for (const language of ["ru", "en"]) {
                settings[row.layout][language] = layouts[row.layout][language].map((text, i) => row.copy?.[language]?.[i] ?? text);
            }
        }
        active = result.data.find(row => row.active).layout;
        drafts = settings;
        client = account;
        templates = { ru, en };
        layout.value = active;
        frame.onload = preview;
        frame.srcdoc = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/prints/build/css/styles.css"></head><body></body></html>';
        form.hidden = false;
        showSelection();
    } catch {
        if (current === version) notice.textContent = "Не удалось загрузить настройки первого экрана. Проверьте миграцию Supabase и обновите страницу.";
    }
}

layout.addEventListener("change", showSelection);
lang.addEventListener("change", showSelection);
for (const field of fields) field.addEventListener("input", () => {
    drafts[layout.value][lang.value] = fields.map(item => item.value);
    preview();
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || !client) return;
    const key = layout.value;
    const copy = drafts[key];
    for (const language of ["ru", "en"]) {
        const missing = copy[language].findIndex(value => !value.trim());
        if (missing >= 0) {
            lang.value = language;
            showSelection();
            fields[missing].focus();
            notice.textContent = "Заполните текст перед публикацией.";
            return;
        }
    }
    const current = version;
    saving = true;
    form.inert = true;
    const storage = client.storage.from("prints-home-photos");
    const photos = [...copy.photos];
    const replaced = [];
    const button = form.querySelector("button");
    button.disabled = true;
    try {
        for (const input of photoInputs) {
            const i = Number(input.dataset.photo);
            const entry = pending.get(key + i);
            if (!entry) continue;
            if (!entry.path) {
                const path = crypto.randomUUID() + "." + extensions[entry.file.type];
                const upload = await storage.upload(path, entry.file, { contentType: entry.file.type });
                if (upload.error) throw upload.error;
                entry.path = path;
            }
            if (current !== version) return;
            if (photos[i] && photos[i] !== entry.path) replaced.push(photos[i]);
            photos[i] = entry.path;
        }
        const { error } = await client.rpc("prints_manage_home_feature", { selected_layout: key, new_copy: { ...copy, photos } });
        if (error) throw error;
        if (current !== version) return;
        copy.photos = photos;
        for (const input of photoInputs) {
            const id = key + input.dataset.photo;
            const entry = pending.get(id);
            if (entry) URL.revokeObjectURL(entry.preview);
            pending.delete(id);
        }
        active = key;
        preview();
        notice.textContent = "Опубликован вариант «" + layouts[key].label + "».";
        if (replaced.length) {
            try {
                const cleanup = await storage.remove(replaced);
                if (cleanup.error) throw cleanup.error;
            } catch {
                if (current === version) notice.textContent += " Прежнее фото осталось в хранилище.";
            }
        }
    } catch {
        if (current === version) notice.textContent = "Не удалось подтвердить публикацию. Обновите страницу и проверьте выбранный вариант.";
    } finally {
        if (current === version) {
            form.inert = false;
            saving = false;
            button.disabled = false;
        }
    }
});

import { loadEditor, resetEditor } from "./feature-editor.js";
import { createPrintsClient } from "/prints/build/js/artist-data.js";

const report = document.querySelector("#report");
const status = document.querySelector("#status");
const login = document.querySelector("#login");
const retry = document.querySelector("#retry");
const metrics = document.querySelector("#metrics");
const trend = document.querySelector("#trend");
const leaders = document.querySelector("#leaders");
const table = document.querySelector("tbody");
const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Bishkek" });
let generation = 0;

function cell(tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
}

function drawBars(container, rows) {
    const maximum = Math.max(1, ...rows.map(row => row.value));
    for (const { label, value } of rows) {
        const line = cell("div", "");
        line.className = "bar-row";
        const track = cell("div", "");
        track.className = "bar-track";
        track.setAttribute("aria-hidden", "true");
        const bar = cell("div", "");
        bar.style.width = (100 * value / maximum) + "%";
        track.append(bar);
        line.append(cell("span", label), cell("strong", value), track);
        container.append(line);
    }
}

function render(authors) {
    const sum = (key) => authors.reduce((total, author) => total + author[key], 0);
    const published = sum("published");
    const drafts = sum("drafts");
    for (const [label, value] of [
        ["Авторов", authors.length], ["Работ у авторов", published + drafts],
        ["Авторы без публикаций", authors.filter(author => author.published === 0).length],
        ["Опубликовано", published], ["Черновики", drafts], ["Загрузки за 30 дней", sum("recent")]
    ]) {
        const item = document.createElement("div");
        item.append(cell("dt", label), cell("dd", value));
        metrics.append(item);
    }
    if (authors.every(author => Number.isFinite(author.previous))) {
        drawBars(trend, [
            { label: "Предыдущие 30 дней", value: sum("previous") },
            { label: "Последние 30 дней", value: sum("recent") }
        ]);
    } else {
        trend.textContent = "Для сравнения периодов обновите функцию статистики в Supabase.";
    }

    const active = authors.filter(author => author.recent > 0)
        .sort((a, b) => b.recent - a.recent || a.name.localeCompare(b.name, "ru")).slice(0, 5);
    if (active.length) {
        drawBars(leaders, active.map(author => ({ label: author.name, value: author.recent })));
    } else {
        leaders.textContent = "За последние 30 дней новых работ нет.";
    }

    for (const author of authors) {
        const row = document.createElement("tr");
        const name = cell("th", author.name);
        name.scope = "row";
        row.append(name, ...[author.city || "—", author.published + author.drafts, author.published,
            author.drafts, author.recent, author.last_upload ? date.format(new Date(author.last_upload)) : "—"]
            .map(value => cell("td", value)));
        table.append(row);
    }
    status.textContent = authors.length ? "" : "В галерее пока нет авторов.";
    report.hidden = false;
}

retry.addEventListener("click", () => location.reload());

try {
    const client = await createPrintsClient({ account: true });
    let sessionOwner;
    client.auth.onAuthStateChange((_event, session) => {
        if (session && session.user.id === sessionOwner && !report.hidden) return;
        sessionOwner = session?.user.id;
        resetEditor();
        const current = ++generation;
        report.hidden = true;
        retry.hidden = true;
        metrics.replaceChildren();
        table.replaceChildren();
        trend.replaceChildren();
        leaders.replaceChildren();
        login.hidden = Boolean(session);
        status.textContent = session ? "Загружаем статистику…" : "Войдите в аккаунт владельца и вернитесь на эту страницу.";
        if (!session) return;
        setTimeout(async () => {
            if (current !== generation) return;
            try {
                const { data, error } = await client.rpc("prints_admin_statistics");
                if (current !== generation) return;
                if (error?.code === "42501") {
                    status.textContent = "Этот раздел доступен только владельцу галереи.";
                    return;
                }
                if (error) throw error;
                render(data);
                loadEditor(client);
            } catch {
                if (current !== generation) return;
                status.textContent = "Не удалось загрузить статистику.";
                retry.hidden = false;
            }
        }, 0);
    });
} catch {
    status.textContent = "Не удалось подключиться к галерее.";
    retry.hidden = false;
}

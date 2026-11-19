import { projectUrl, publishableKey } from "./supabase-config.js";

const authForm = document.querySelector("#artist-auth");
const gallery = document.querySelector("#gallery-works");
const status = document.querySelector(authForm ? "#artist-status" : "#gallery-status");
const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const artworkFields = "id,artist_id,artist_name,city,title,description,is_published,created_at";

const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
};

function setStatus(message) {
    // Clear the live region before repeating an announcement.
    status.textContent = message;
}

function unwrap({ data, error }) {
    if (error) throw error;
    return data;
}

async function run(control, action, fallback) {
    control.disabled = true;
    setStatus("");
    try {
        await action();
    } catch (error) {
        console.warn("Prints:", error.code || error.status || error.name);
        setStatus(Number(error.status) === 429
            ? "Слишком много попыток. Подождите немного и попробуйте снова."
            : fallback);
    } finally {
        control.disabled = false;
    }
}

const photoPath = (work) => `${work.artist_id}/${work.id}`;

async function withPhotos(storage, works) {
    if (!works.length) return [];
    const images = unwrap(await storage.createSignedUrls(works.map(photoPath), 3600));
    const urls = new Map(images.filter((image) => image.signedUrl)
        .map((image) => [image.path, image.signedUrl]));
    return works.map((work) => ({ ...work, imageUrl: urls.get(photoPath(work)) }));
}

function workCard(work) {
    const card = element("article", "", "artist-card");
    if (work.imageUrl) {
        const img = element("img");
        img.src = work.imageUrl;
        img.alt = work.title;
        card.append(img);
    }
    card.append(element("h3", work.title), element("p", `${work.artist_name} · ${work.city}`));
    if (work.description) card.append(element("p", work.description));
    return card;
}

function initGallery(client, storage) {
    const more = document.querySelector("#gallery-more");
    let cursor;
    let visible = 0;
    const pageSize = 12;

    async function load() {
        let query = client.from("prints_artworks").select(artworkFields).eq("is_published", true);
        if (cursor) {
            query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
        }
        const works = unwrap(await query.order("created_at", { ascending: false })
            .order("id", { ascending: false }).limit(pageSize + 1));
        const page = await withPhotos(storage, works.slice(0, pageSize));

        for (const work of page.filter((entry) => entry.imageUrl)) {
            gallery.append(workCard(work));
            visible += 1;
        }
        cursor = page.at(-1) || cursor;
        more.hidden = works.length <= pageSize;
        setStatus(!visible && more.hidden ? "Опубликованных работ пока нет." : "");
    }

    const loadPage = () => run(more, load, "Не удалось загрузить работы. Попробуйте ещё раз.");
    more.addEventListener("click", loadPage);
    setStatus("Загружаем работы…");
    loadPage().then(() => {
        if (!cursor && !visible && status.textContent.startsWith("Не удалось")) {
            more.hidden = false;
        }
    });
}

function initDashboard(client, storage) {
    const dashboard = document.querySelector("#artist-dashboard");
    const workForm = document.querySelector("#artist-work");
    const worksList = document.querySelector("#artist-works");
    const worksStatus = document.querySelector("#artist-works-status");
    const email = document.querySelector("#artist-email");
    const signOut = document.querySelector("#artist-signout");
    const callback = new URL(window.location.href);
    callback.search = "";
    callback.hash = "";
    let userId = null;

    async function uploadPhoto(work, photo) {
        if (!photoTypes.includes(photo.type) || !photo.size || photo.size > 5 * 1024 * 1024) {
            setStatus("Выберите файл JPEG, PNG или WebP размером до 5 МБ.");
            return false;
        }
        unwrap(await storage.upload(photoPath(work), photo, { contentType: photo.type }));
        return true;
    }

    async function refreshWorks(owner) {
        try {
            const works = unwrap(await client.from("prints_artworks").select(artworkFields)
                .eq("artist_id", owner).order("created_at", { ascending: false }));
            const entries = await withPhotos(storage, works);
            if (owner !== userId) return;
            worksStatus.textContent = entries.length ? "" : "У вас пока нет работ.";
            worksList.replaceChildren(...entries.map(dashboardCard));
        } catch {
            if (owner === userId) worksStatus.textContent = "Не удалось обновить список работ. Перезагрузите страницу.";
        }
    }

    function dashboardCard(work) {
        const card = workCard(work);
        card.append(element("p", work.is_published ? "Опубликовано" : "Черновик"));
        if (!work.imageUrl) {
            const form = element("form", "", "artist-form");
            const label = element("label", "Загрузите фото работы");
            const input = element("input");
            input.type = "file";
            input.accept = photoTypes.join(",");
            input.required = true;
            const button = element("button", "Загрузить фото", "button button--solid");
            label.append(input);
            form.append(label, button);
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                run(button, async () => {
                    try {
                        if (await uploadPhoto(work, input.files[0])) setStatus("Фото загружено.");
                    } finally {
                        await refreshWorks(work.artist_id);
                    }
                }, "Не удалось загрузить фото. Обновите страницу и попробуйте ещё раз.");
            });
            card.append(form);
        }

        if (work.imageUrl || work.is_published) {
            const button = element("button", work.is_published ? "Скрыть" : "Опубликовать", "button button--solid");
            button.type = "button";
            button.addEventListener("click", () => run(button, async () => {
                unwrap(await client.from("prints_artworks")
                    .update({ is_published: !work.is_published }).eq("id", work.id)
                    .eq("artist_id", work.artist_id).select("id").single());
                setStatus(work.is_published ? "Работа скрыта." : "Работа опубликована.");
                await refreshWorks(work.artist_id);
            }, "Не удалось изменить статус работы. Попробуйте ещё раз."));
            card.append(button);
        }
        return card;
    }

    authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        run(event.submitter, async () => {
            unwrap(await client.auth.signInWithOtp({
                email: new FormData(authForm).get("email").trim(),
                options: { emailRedirectTo: callback.href }
            }));
            setStatus("Ссылка отправлена. Откройте письмо, чтобы войти в кабинет.");
        }, "Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз.");
    });

    signOut.addEventListener("click", () => run(signOut, async () => {
        unwrap(await client.auth.signOut({ scope: "local" }));
    }, "Не удалось выйти. Попробуйте ещё раз."));

    workForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const owner = userId;
        const formData = new FormData(workForm);
        const photo = formData.get("photo");
        const details = Object.fromEntries(["artist_name", "city", "title", "description"]
            .map((field) => [field, formData.get(field).trim()]));
        run(event.submitter, async () => {
            if (!details.artist_name || !details.city || !details.title) {
                setStatus("Заполните имя, город и название работы.");
                return;
            }
            if (!photoTypes.includes(photo.type) || !photo.size || photo.size > 5 * 1024 * 1024) {
                setStatus("Выберите файл JPEG, PNG или WebP размером до 5 МБ.");
                return;
            }
            const work = unwrap(await client.from("prints_artworks").insert(details)
                .select("id,artist_id").single());
            workForm.reset();
            try {
                await uploadPhoto(work, photo);
                setStatus("Черновик сохранён. Опубликуйте работу в разделе «Мои работы».");
            } finally {
                await refreshWorks(owner);
            }
        }, "Не удалось сохранить работу полностью. Проверьте «Мои работы» и повторите загрузку фото, если черновик появился.");
    });

    const authError = new URLSearchParams(window.location.hash.slice(1)).has("error")
        || new URLSearchParams(window.location.search).has("error");
    client.auth.onAuthStateChange((event, session) => {
        const nextId = session?.user.id || null;
        if (event !== "INITIAL_SESSION" && nextId === userId) return;
        userId = nextId;
        authForm.hidden = Boolean(userId);
        dashboard.hidden = !userId;
        email.textContent = session?.user.email || "";
        worksList.replaceChildren();
        workForm.reset();
        setStatus(authError && !userId && event === "INITIAL_SESSION"
            ? "Ссылка для входа недействительна или устарела. Запросите новую."
            : "");
        if (nextId) {
            worksStatus.textContent = "Загружаем ваши работы…";
            // Supabase processes auth callbacks under a lock. Query after it returns.
            setTimeout(() => {
                if (nextId === userId) refreshWorks(nextId);
            }, 0);
        }
    });
}

async function init() {
    if (!projectUrl || !publishableKey) {
        setStatus(authForm ? "Регистрация пока недоступна." : "Галерея художников скоро откроется.");
        return;
    }
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const client = createClient(projectUrl, publishableKey, {
        auth: { storageKey: "mukashov-prints-session", detectSessionInUrl: Boolean(authForm) }
    });
    const storage = client.storage.from("prints-artworks");
    if (authForm) initDashboard(client, storage);
    if (gallery) initGallery(client, storage);
}

init().catch(() => setStatus("Сервис сейчас недоступен. Попробуйте обновить страницу."));

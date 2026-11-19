import { createPrintsClient, fetchWorks, photoPath, unwrap } from "./artist-data.js";

const slugCooldownMs = 14 * 24 * 60 * 60 * 1000;
const authForm = document.querySelector("#artist-auth");
const status = document.querySelector("#artist-status");
const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const validPhoto = (photo) => photoTypes.includes(photo.type) && photo.size > 0 && photo.size <= 5 * 1024 * 1024;

async function imageOrientation(photo) {
    const source = URL.createObjectURL(photo);
    const image = new Image();
    image.src = source;
    try {
        await image.decode();
        if (image.naturalWidth === image.naturalHeight) return "square";
        return image.naturalWidth > image.naturalHeight ? "landscape" : "portrait";
    } finally {
        URL.revokeObjectURL(source);
    }
}

const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
};

function setStatus(message) {
    status.textContent = message;
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

function workCard(work) {
    const card = element("article", "", "artist-card");
    if (work.imageUrl) {
        const img = element("img");
        img.src = work.imageUrl;
        img.alt = work.title;
        card.append(img);
    }
    card.append(element("h3", work.title), element("p", `${work.artist_name} · ${work.city}`));
    return card;
}

function mountOfferFields(container, work = {}) {
    container.append(document.querySelector("#artwork-offer-fields").content.cloneNode(true));
    const select = container.querySelector("select");
    const kinds = ["original", "print"];
    const selectedKinds = kinds.filter((kind) => work[`${kind}_price`] != null);
    select.value = selectedKinds.length === 2 ? "both" : selectedKinds[0] || "";

    for (const input of container.querySelectorAll("input")) {
        if (input.type === "checkbox") {
            input.checked = Boolean(work[input.name]);
        } else {
            input.value = work[input.name] ?? "";
        }
    }

    function sync() {
        for (const fieldset of container.querySelectorAll("[data-offer-kind]")) {
            const enabled = select.value === "both" || select.value === fieldset.dataset.offerKind;
            fieldset.hidden = !enabled;
            fieldset.disabled = !enabled;
        }
    }

    select.addEventListener("change", sync);
    sync();
    return sync;
}

function readOfferFields(formData) {
    const number = (name) => {
        const value = formData.get(name);
        return value == null || value === "" ? null : Number(value);
    };
    return {
        original_price: number("original_price"),
        original_sold: formData.has("original_sold"),
        print_price: number("print_price"),
        print_stock: number("print_stock")
    };
}

function initDashboard(client, storage) {
    const dashboard = document.querySelector("#artist-dashboard");
    const authPanel = document.querySelector("#artist-auth-panel");
    const authMode = new URLSearchParams(window.location.search).get("mode") === "register"
        ? "register"
        : "login";
    const isRegistration = authMode === "register";
    const authTitle = document.querySelector("#artist-auth-title");
    authTitle.textContent = isRegistration ? "Регистрация" : "Вход в кабинет";
    authForm.querySelector("button").textContent = isRegistration ? "Получить ссылку для регистрации" : "Получить ссылку для входа";
    authPanel.querySelector(`[data-auth-mode="${authMode}"]`).setAttribute("aria-current", "page");
    const profileForm = document.querySelector("#artist-profile-form");
    const addressInput = profileForm.elements.namedItem("profile_slug");
    const addressHint = document.querySelector("#artist-address-hint");
    const profileLink = document.querySelector("#artist-profile-link");
    const workForm = document.querySelector("#artist-work");
    const syncNewOffer = mountOfferFields(workForm.querySelector("[data-offer-fields]"));
    const worksList = document.querySelector("#artist-works");
    const worksStatus = document.querySelector("#artist-works-status");
    const email = document.querySelector("#artist-email");
    const sections = Array.from(dashboard.querySelectorAll("[data-artist-panel]"));
    const sectionLinks = dashboard.querySelectorAll("[data-artist-view]");
    const requestedSection = () => window.location.hash.slice(1);
    const callback = new URL(window.location.href);
    callback.search = "";
    callback.hash = "";
    let userId = null;
    let profile = null;

    function showSection(view) {
        const requested = sections.some((section) => section.dataset.artistPanel === view)
            ? view
            : profile ? "works" : "profile";
        const selected = requested === "new-work" && !profile ? "profile" : requested;
        for (const section of sections) section.hidden = section.dataset.artistPanel !== selected;
        for (const link of sectionLinks) {
            if (link.dataset.artistView === selected) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
        if (requested !== selected) setStatus("Сначала сохраните профиль художника.");
    }

    window.addEventListener("hashchange", () => {
        if (userId) showSection(requestedSection());
    });

    async function loadProfile(owner) {
        const saved = unwrap(await client.from("prints_artist_profiles")
            .select("artist_name,city,whatsapp,profile_slug,profile_slug_changed_at").eq("artist_id", owner).maybeSingle());
        if (owner !== userId) return;
        profile = saved;
        if (saved) {
            for (const field of ["artist_name", "city", "whatsapp"]) {
                profileForm.elements.namedItem(field).value = saved[field];
            }
        }
        addressInput.value = saved?.profile_slug || "";
        const availableAt = Date.parse(saved?.profile_slug_changed_at) + slugCooldownMs;
        addressInput.disabled = availableAt > Date.now();
        addressHint.textContent = addressInput.disabled
            ? `Адрес можно изменить с ${new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "long", timeStyle: "short"
            }).format(availableAt)}.`
            : "От 3 до 40 символов. Латинские буквы, цифры и дефис. Менять адрес можно раз в 14 дней.";
        profileLink.hidden = !saved?.profile_slug;
        if (saved?.profile_slug) profileLink.href = `/${encodeURIComponent(saved.profile_slug)}`;
    }

    async function uploadPhoto(work, photo, interior = false) {
        unwrap(await storage.upload(photoPath(work, interior), photo, { contentType: photo.type }));
    }

    async function refreshWorks(owner) {
        try {
            const entries = await fetchWorks(client, { owner });
            if (owner !== userId) return;
            worksStatus.textContent = entries.length ? "" : "У вас пока нет работ.";
            worksList.replaceChildren(...entries.map(dashboardCard));
        } catch {
            if (owner === userId) worksStatus.textContent = "Не удалось обновить список работ. Перезагрузите страницу.";
        }
    }

    function dashboardCard(work) {
        const card = workCard(work);
        card.append(element("p", work.is_published ? "Опубликовано" : "Черновик", "artist-card__status"));
        const actions = element("div", "", "artist-card__actions");
        const editor = element("details", "", "artwork-offer-editor");
        editor.append(element("summary", "Редактировать работу"));
        if (work.is_published) {
            const link = element("a", "Открыть страницу работы", "button button--line");
            link.href = `./product.html?slug=artist-${work.id}`;
            actions.append(link);
        }

        function photoForm(interior) {
            const form = element("form", "", "artist-form");
            const label = element("label", interior ? "Фото в интерьере" : "Загрузите фото работы");
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
                        const photo = input.files[0];
                        if (!validPhoto(photo)) {
                            setStatus("Выберите файл JPEG, PNG или WebP размером до 5 МБ.");
                            return;
                        }
                        if (!interior) {
                            const orientation = await imageOrientation(photo);
                            unwrap(await client.from("prints_artworks").update({ orientation }).eq("id", work.id));
                        }
                        await uploadPhoto(work, photo, interior);
                        setStatus("Фото загружено.");
                    } finally {
                        await refreshWorks(work.artist_id);
                    }
                }, "Не удалось загрузить фото. Обновите страницу и попробуйте ещё раз.");
            });
            return form;
        }

        if (!work.imageUrl) editor.append(photoForm(false));
        if (work.imageUrl && !work.interiorUrl) editor.append(photoForm(true));

        const editForm = element("form", "", "artist-form");
        for (const name of ["title", "description", "category"]) {
            const source = workForm.elements.namedItem(name);
            const field = source.cloneNode(true);
            const label = source.closest("label").cloneNode(false);
            field.value = work[name] ?? "";
            label.append(document.createTextNode(source.closest("label").firstChild.textContent), field);
            editForm.append(label);
        }

        const offerFields = element("div");
        offerFields.setAttribute("data-offer-fields", "");
        mountOfferFields(offerFields, work);
        const offerType = offerFields.querySelector("select");
        offerType.required = false;
        offerType.options[0].textContent = "Без вариантов продажи";
        const saveWork = element("button", "Сохранить изменения", "button button--line");
        editForm.append(offerFields, saveWork);
        editor.append(editForm);
        editForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const fields = new FormData(editForm);
            run(saveWork, async () => {
                const title = fields.get("title").trim();
                if (!title) {
                    setStatus("Укажите название работы.");
                    return;
                }
                unwrap(await client.from("prints_artworks").update({
                    title,
                    description: fields.get("description").trim(),
                    category: fields.get("category"),
                    ...readOfferFields(fields)
                }).eq("id", work.id).eq("artist_id", work.artist_id).select("id").single());
                setStatus("Изменения сохранены.");
                await refreshWorks(work.artist_id);
            }, "Не удалось сохранить изменения.");
        });

        if (work.imageUrl || work.is_published) {
            const button = element("button", work.is_published ? "Скрыть" : "Опубликовать", "button button--solid");
            button.type = "button";
            button.addEventListener("click", () => run(button, async () => {
                if (!work.is_published && (!profile || !work.category)) {
                    if (!profile) showSection("profile");
                    else editor.open = true;
                    setStatus("Перед публикацией сохраните профиль и выберите категорию работы.");
                    return;
                }
                if (!work.is_published && work.original_price == null && work.print_price == null) {
                    editor.open = true;
                    setStatus("Перед публикацией сохраните хотя бы один вариант продажи.");
                    return;
                }
                unwrap(await client.from("prints_artworks")
                    .update({ is_published: !work.is_published }).eq("id", work.id)
                    .eq("artist_id", work.artist_id).select("id").single());
                setStatus(work.is_published ? "Работа скрыта." : "Работа опубликована.");
                await refreshWorks(work.artist_id);
            }, "Не удалось изменить статус работы. Попробуйте ещё раз."));
            actions.append(button);
        }
        card.append(actions, editor);
        return card;
    }

    authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        run(event.submitter, async () => {
            unwrap(await client.auth.signInWithOtp({
                email: new FormData(authForm).get("email").trim(),
                options: { emailRedirectTo: callback.href, shouldCreateUser: isRegistration }
            }));
            setStatus("Проверьте почту. Откройте ссылку из письма, чтобы продолжить.");
        }, "Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз.");
    });

    profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const owner = userId;
        const fields = new FormData(profileForm);
        const artist_name = fields.get("artist_name").trim();
        const city = fields.get("city").trim();
        const whatsapp = fields.get("whatsapp").replace(/[\s().-]/g, "");

        run(event.submitter, async () => {
            if (!artist_name || !city || !/^\+[1-9]\d{7,14}$/.test(whatsapp)) {
                setStatus("Укажите имя, город и номер WhatsApp в международном формате, например +996 700 123 456.");
                return;
            }
            const details = { artist_id: owner, artist_name, city, whatsapp };
            if (fields.has("profile_slug")) {
                const slug = fields.get("profile_slug").trim().toLowerCase();
                if (slug && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
                    setStatus("Укажите от 3 до 40 символов. Начните и закончите адрес латинской буквой или цифрой.");
                    return;
                }
                details.profile_slug = slug || null;
            }
            const response = await client.from("prints_artist_profiles").upsert(details);
            if (response.error?.code === "23505" || response.error?.code === "23514") {
                setStatus("Этот адрес недоступен. Выберите другой.");
                return;
            }
            if (response.error?.code === "PT409") {
                if (owner === userId) {
                    await loadProfile(owner);
                    setStatus("Короткий адрес можно менять только раз в 14 дней.");
                }
                return;
            }
            unwrap(response);
            if (owner !== userId) return;
            await loadProfile(owner);
            if (owner !== userId) return;
            const nextSection = requestedSection() === "new-work" ? "new-work" : "works";
            window.history.replaceState(null, "", `#${nextSection}`);
            showSection(nextSection);
            setStatus("Профиль сохранён.");
            await refreshWorks(owner);
        }, "Не удалось сохранить профиль. Попробуйте ещё раз.");
    });

    workForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const owner = userId;
        const formData = new FormData(workForm);
        const photo = formData.get("photo");
        const interior = formData.get("interior");
        const details = Object.fromEntries(["title", "description", "category"]
            .map((field) => [field, formData.get(field).trim()]));
        run(event.submitter, async () => {
            if (!profile || !details.title || !details.category) {
                setStatus("Сохраните профиль и заполните название и категорию работы.");
                return;
            }
            if (!validPhoto(photo) || (interior.size && !validPhoto(interior))) {
                setStatus("Выберите JPEG, PNG или WebP. Максимальный размер каждого файла — 5 МБ.");
                return;
            }
            details.orientation = await imageOrientation(photo);
            if (owner !== userId) return;
            const work = unwrap(await client.from("prints_artworks").insert({ ...details, ...readOfferFields(formData) })
                .select("id,artist_id").single());
            workForm.reset();
            syncNewOffer();
            try {
                await uploadPhoto(work, photo);
                if (interior.size) await uploadPhoto(work, interior, true);
                setStatus("Черновик сохранён. Теперь его можно опубликовать.");
            } finally {
                if (owner === userId) {
                    window.history.replaceState(null, "", "#works");
                    showSection("works");
                    await refreshWorks(owner);
                }
            }
        }, "Не удалось сохранить работу полностью. Если черновик появился в «Моих работах», недостающие фото можно добавить там.");
    });

    const authError = new URLSearchParams(window.location.hash.slice(1)).has("error")
        || new URLSearchParams(window.location.search).has("error");
    client.auth.onAuthStateChange((event, session) => {
        const nextId = session?.user.id || null;
        if (event !== "INITIAL_SESSION" && nextId === userId) return;
        userId = nextId;
        authPanel.hidden = Boolean(userId);
        dashboard.hidden = !userId;
        email.textContent = session?.user.email || "";
        worksList.replaceChildren();
        profile = null;
        profileForm.reset();
        workForm.reset();
        syncNewOffer();
        for (const section of sections) section.hidden = true;
        setStatus(authError && !userId && event === "INITIAL_SESSION"
            ? "Ссылка для входа недействительна или устарела. Запросите новую."
            : "");
        if (nextId) {
            worksStatus.textContent = "Загружаем ваши работы…";
            // Supabase processes auth callbacks under a lock. Query after it returns.
            setTimeout(() => {
                if (nextId !== userId) return;
                loadProfile(nextId).then(() => {
                    if (nextId === userId) showSection(requestedSection());
                }).catch(() => {
                    if (nextId === userId) setStatus("Не удалось загрузить профиль. Обновите страницу.");
                });
                refreshWorks(nextId);
            }, 0);
        }
    });
}

async function init() {
    const client = await createPrintsClient({ account: true });
    initDashboard(client, client.storage.from("prints-artworks"));
}

init().catch(() => setStatus("Сервис сейчас недоступен. Попробуйте обновить страницу."));

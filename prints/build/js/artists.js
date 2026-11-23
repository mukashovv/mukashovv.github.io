import { applyCatalogueAssignment, createPrintsClient, fetchWorks, loadCatalogArtistAssignments, photoPath, portraitUrl, unwrap } from "./artist-data.js";
import { PhotoPreparationError, photoTypes, preparePhoto } from "./image-compression.js?v=5";

const slugCooldownMs = 14 * 24 * 60 * 60 * 1000;
const authForm = document.querySelector("#artist-auth");
const status = document.querySelector("#artist-status");
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
        if (error instanceof PhotoPreparationError) {
            setStatus(error.message);
        } else {
            setStatus(Number(error.status) === 429
                ? "Слишком много попыток. Подождите немного и попробуйте снова."
                : fallback);
        }
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
    card.append(element("h3", work.title), element("p", [work.artist_name, work.city].filter(Boolean).join(" · ")));
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

    for (const kind of kinds) {
        const picker = container.querySelector(`[name="${kind}_size"]`);
        const sizes = window.printsShared.sizes;
        for (const size of sizes) picker.add(new Option(size.label, size.id), picker.options.length - 1);
        const width = work[`${kind}_width`];
        const height = work[`${kind}_height`];
        if (width && height) {
            const id = `${width}x${height}`;
            picker.value = sizes.some(size => size.id === id) ? id : "custom";
        }
        picker.addEventListener("change", sync);
    }

    function sync() {
        for (const fieldset of container.querySelectorAll("[data-offer-kind]")) {
            const enabled = select.value === "both" || select.value === fieldset.dataset.offerKind;
            fieldset.hidden = !enabled;
            fieldset.disabled = !enabled;
            const custom = fieldset.querySelector("[data-size-selector]").value === "custom";
            const dimensions = fieldset.querySelector("[data-dimensions]");
            dimensions.hidden = !custom;
            for (const input of dimensions.querySelectorAll("input")) input.disabled = !custom;
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
    const dimensions = {};
    for (const kind of ["original", "print"]) {
        const selected = formData.get(`${kind}_size`);
        const [width, height] = selected === "custom"
            ? [number(`${kind}_width`), number(`${kind}_height`)]
            : selected ? selected.split("x").map(Number) : [null, null];
        dimensions[`${kind}_width`] = width;
        dimensions[`${kind}_height`] = height;
    }
    return {
        ...dimensions,
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
    if (isRegistration) {
        authForm.elements.password.disabled = true;
        document.querySelector("#login-password").hidden = true;
        authForm.querySelector('[value="password"]').hidden = true;
        authForm.querySelector('[value="recover"]').hidden = true;
        authForm.querySelector('[value="link"]').textContent = "Получить ссылку для регистрации";
    }
    authPanel.querySelector(`[data-auth-mode="${authMode}"]`).setAttribute("aria-current", "page");
    const profileForm = document.querySelector("#artist-profile-form");
    const portraitImage = document.querySelector("#artist-portrait");
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
            .select("artist_name,city,whatsapp,profile_slug,profile_slug_changed_at,bio,portrait_version").eq("artist_id", owner).maybeSingle());
        if (owner !== userId) return;
        profile = saved;
        if (saved) {
            for (const field of ["artist_name", "city", "whatsapp"]) {
                profileForm.elements.namedItem(field).value = saved[field];
            }
        }
        profileForm.elements.bio.value = saved?.bio || "";
        portraitImage.hidden = !saved?.portrait_version;
        if (saved?.portrait_version) portraitImage.src = portraitUrl(owner, saved.portrait_version);
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

    async function uploadPhoto(work, { blob, width, height }, interior = false) {
        if (!interior && work.imageUrl) {
            unwrap(await storage.update(photoPath(work), blob, { contentType: blob.type, cacheControl: "0" }));
        } else unwrap(await storage.upload(photoPath(work, interior), blob, { contentType: blob.type, upsert: interior }));
        return `${width} × ${height} пикс., ${Math.ceil(blob.size / 1024)} КБ`;
    }

    const layoutButtons = dashboard.querySelectorAll("[data-layout]");
    function setLayout(value) {
        worksList.dataset.layout = value;
        for (const button of layoutButtons) button.setAttribute("aria-pressed", String(button.dataset.layout === value));
    }
    setLayout(localStorage.getItem("prints-works-layout") === "list" ? "list" : "grid");
    for (const button of layoutButtons) button.onclick = () => {
        setLayout(button.dataset.layout);
        localStorage.setItem("prints-works-layout", button.dataset.layout);
    };
    const batchTools = document.querySelector("#batch-tools");
    const selectAll = document.querySelector("#select-all-works");
    const boxes = () => Array.from(worksList.querySelectorAll("[data-work-select]"));
    function updateSelection() {
        const all = boxes();
        const selected = all.filter(box => box.checked);
        batchTools.hidden = !all.length;
        selectAll.checked = all.length > 0 && selected.length === all.length;
        selectAll.indeterminate = selected.length > 0 && !selectAll.checked;
        document.querySelector("#selected-count").textContent = selected.length ? `Выбрано: ${selected.length}` : "";
        for (const button of batchTools.querySelectorAll("button")) button.disabled = !selected.length;
    }
    selectAll.onchange = () => {
        for (const box of boxes()) box.checked = selectAll.checked;
        updateSelection();
    };
    for (const button of batchTools.querySelectorAll("button")) button.onclick = () => run(button, async () => {
        const owner = userId;
        const publish = button.dataset.publish === "yes";
        const selected = boxes().filter(box => box.checked);
        const ids = selected.filter(box => !publish || box.dataset.ready === "true").map(box => box.value);
        let count = 0;
        for (let i = 0; i < ids.length && owner === userId; i += 50) {
            const rows = unwrap(await client.from("prints_artworks").update({ is_published: publish })
                .eq("artist_id", owner).in("id", ids.slice(i, i + 50)).select("id"));
            count += rows.length;
        }
        if (owner !== userId) return;
        setStatus(`Обработано: ${count} из ${selected.length}.` + (ids.length < selected.length ? " Для публикации нужны фото, категория и цена." : ""));
        await refreshWorks(owner);
        queueMicrotask(updateSelection);
    }, "Не удалось обработать все работы. Обновите список и проверьте статусы.");

    async function refreshWorks(owner) {
        try {
            const [entries, assignments] = await Promise.all([
                fetchWorks(client, { owner }),
                loadCatalogArtistAssignments().catch(() => [])
            ]);
            if (owner !== userId) return;
            const assigned = new Map(assignments.filter((entry) => entry.artist_id === owner)
                .map((entry) => [entry.product_slug, entry]));
            const catalogueWorks = (window.printsCatalog || []).filter((work) => assigned.has(work.slug))
                .map((work) => applyCatalogueAssignment(work, assigned.get(work.slug)));
            worksStatus.textContent = entries.length || catalogueWorks.length ? "" : "У вас пока нет работ.";
            worksList.replaceChildren(...entries.map(dashboardCard), ...catalogueWorks.map(catalogueCard));
            updateSelection();
        } catch {
            if (owner === userId) worksStatus.textContent = "Не удалось обновить список работ. Перезагрузите страницу.";
        }
    }

    function artworkDetailsForm(work) {
        const form = element("form", "", "artist-form");
        for (const name of ["title", "description", "category"]) {
            const source = workForm.elements.namedItem(name);
            const field = source.cloneNode(true);
            const sourceLabel = source.closest("label");
            const label = sourceLabel.cloneNode(false);
            field.value = work[name] ?? "";
            label.append(document.createTextNode(sourceLabel.firstChild.textContent), field);
            form.append(label);
        }
        return form;
    }

    function catalogueCard(work) {
        const card = workCard({ ...work, imageUrl: work.image, artist_name: work.artist, city: profile?.city || "" });
        const status = element("p", "Опубликовано в основном каталоге", "artist-card__status");
        const link = element("a", "Открыть", "button button--line");
        link.href = `./product.html?slug=${encodeURIComponent(work.slug)}`;
        card.append(status, link);
        if (!work.canEditCatalogue) return card;

        const editor = element("details", "", "artwork-offer-editor");
        const editForm = artworkDetailsForm({ ...work, description: work.summary });
        const sizes = (window.printsShared?.sizes || []).filter((size) => Object.hasOwn(work.priceBySize, size.id));
        for (const size of sizes) {
            const label = element("label", `${size.label} · цена, сом`);
            const field = element("input");
            field.type = "number";
            field.name = `price_${size.id}`;
            field.min = "1";
            field.max = "100000000";
            field.step = "1";
            field.required = true;
            field.value = work.priceBySize[size.id];
            label.append(field);
            editForm.append(label);
        }
        const save = element("button", "Сохранить изменения", "button button--line");
        editForm.append(save);
        editor.append(element("summary", "Изменить"), editForm);
        card.append(editor);

        editForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const fields = new FormData(editForm);
            run(save, async () => {
                const title = fields.get("title").trim();
                if (!title) {
                    setStatus("Укажите название работы.");
                    return;
                }
                const prices = Object.fromEntries(sizes.map(({ id }) => [
                    `price_${id}`, Number(fields.get(`price_${id}`))
                ]));
                unwrap(await client.from("prints_catalog_artist_assignments").update({
                    title,
                    work_description: fields.get("description").trim(),
                    category: fields.get("category"),
                    ...prices
                }).eq("product_slug", work.slug).eq("artist_id", work.artistId).select("product_slug").single());
                setStatus("Изменения сохранены.");
                await refreshWorks(work.artistId);
            }, "Не удалось сохранить изменения.");
        });
        return card;
    }

    function dashboardCard(work) {
        const card = workCard(work);
        const box = element("input");
        box.type = "checkbox";
        box.value = work.id;
        box.dataset.workSelect = "";
        box.dataset.ready = String(Boolean(work.imageUrl && work.category && (work.original_price != null || work.print_price != null)));
        box.setAttribute("aria-label", "Выбрать " + work.title);
        box.onchange = updateSelection;
        card.prepend(box);
        card.append(element("p", work.is_published ? "Опубликовано" : "Черновик", "artist-card__status"));
        const actions = element("div", "", "artist-card__actions");
        const editor = element("details", "", "artwork-offer-editor");
        editor.append(element("summary", "Изменить"));
        if (work.is_published) {
            const link = element("a", "Открыть", "button button--line");
            link.href = `./product.html?slug=artist-${work.id}`;
            actions.append(link);
        }

        function photoForm(interior) {
            const form = element("form", "", "artist-form");
            const label = element("label", interior ? "Фото в интерьере" : "Основное фото");
            const input = element("input");
            input.type = "file";
            input.accept = photoTypes.join(",");
            input.required = true;
            const button = element("button", (interior ? work.interiorUrl : work.imageUrl) ? "Заменить фото" : "Загрузить фото", "button button--solid");
            label.append(input);
            form.append(label, button);
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                run(button, async () => {
                    setStatus("Подготавливаем изображение…");
                    const photo = await preparePhoto(input.files[0], { interior });
                    if (work.artist_id !== userId) return;
                    try {
                        setStatus("Загружаем изображение…");
                        const size = await uploadPhoto(work, photo, interior);
                        if (!interior) {
                            unwrap(await client.from("prints_artworks")
                                .update({ orientation: photo.orientation }).eq("id", work.id));
                        }
                        setStatus(`Фото загружено · ${size}.`);
                    } finally {
                        await refreshWorks(work.artist_id);
                    }
                }, "Не удалось загрузить фото. Обновите страницу и попробуйте ещё раз.");
            });
            return form;
        }

        editor.append(photoForm(false));
        if (work.imageUrl || work.interiorUrl) editor.append(photoForm(true));

        const editForm = artworkDetailsForm(work);

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
        const remove = element("button", "Удалить", "button button--line");
        remove.type = "button";
        const confirmation = element("div", "", "artist-card__actions");
        confirmation.hidden = true;
        const prompt = element("span", `Удалить «${work.title}» и её фотографии навсегда?`);
        const cancel = element("button", "Отмена", "button button--line");
        const confirm = element("button", "Да, удалить", "button button--line");
        cancel.type = confirm.type = "button";
        confirmation.append(prompt, cancel, confirm);
        remove.addEventListener("click", () => {
            confirmation.hidden = false;
            remove.disabled = true;
            cancel.focus();
        });
        cancel.addEventListener("click", () => {
            confirmation.hidden = true;
            remove.disabled = false;
            remove.focus();
        });
        confirm.addEventListener("click", () => run(confirm, async () => {
            const owner = work.artist_id;
            if (owner !== userId) return;
            cancel.disabled = true;
            try {
                const result = await client.from("prints_artworks").delete()
                    .eq("id", work.id).eq("artist_id", owner).select("id").maybeSingle();
                if (result.error?.code === "42501" || (!result.error && !result.data)) {
                    prompt.textContent = "Удаление недоступно. Проверьте права в Supabase или обновите список работ.";
                    return;
                }
                unwrap(result);
                card.remove();
                try {
                    const deleted = unwrap(await storage.remove([photoPath(work), photoPath(work, true)]));
                    const names = new Set(deleted.map((file) => file.name));
                    const missing = (work.imageUrl && !names.has(photoPath(work)))
                        || (work.interiorUrl && !names.has(photoPath(work, true)));
                    setStatus(missing ? "Работа удалена. Не удалось подтвердить удаление всех фотографий." : "Работа удалена.");
                } catch {
                    setStatus("Работа удалена. Не удалось подтвердить удаление фотографий из хранилища.");
                }
                await refreshWorks(owner);
            } catch (error) {
                prompt.textContent = "Не удалось подтвердить удаление. Обновите список работ и попробуйте снова.";
                throw error;
            } finally {
                cancel.disabled = false;
            }
        }, "Не удалось подтвердить удаление работы."));
        actions.append(remove);
        card.append(actions, confirmation, editor);
        return card;
    }

    authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const action = isRegistration ? "link" : event.submitter?.value || "password";
        const emailField = authForm.elements.email;
        if (!emailField.reportValidity()) return;
        const email = emailField.value.trim();
        run(event.submitter || authForm.querySelector("button"), async () => {
            if (action === "password") {
                unwrap(await client.auth.signInWithPassword({ email, password: authForm.elements.password.value }));
                authForm.elements.password.value = "";
                return;
            }
            if (action === "recover") {
                unwrap(await client.auth.resetPasswordForEmail(email, {
                    redirectTo: new URL("./reset-password.html", callback).href
                }));
                setStatus("Если аккаунт существует, на эту почту придёт ссылка для смены пароля.");
                return;
            }
            unwrap(await client.auth.signInWithOtp({ email,
                options: { emailRedirectTo: callback.href, shouldCreateUser: isRegistration }
            }));
            setStatus("Проверьте почту. Откройте ссылку из письма, чтобы продолжить.");
        }, action === "password" ? "Не удалось войти. Проверьте почту и пароль." : "Не удалось отправить письмо. Попробуйте ещё раз.");
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
            const details = { artist_id: owner, artist_name, city, whatsapp, bio: fields.get("bio").trim() };
            if (fields.has("profile_slug")) {
                const slug = fields.get("profile_slug").trim().toLowerCase();
                if (slug && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
                    setStatus("Укажите от 3 до 40 символов. Начните и закончите адрес латинской буквой или цифрой.");
                    return;
                }
                details.profile_slug = slug || null;
            }
            const portrait = fields.get("portrait");
            const prepared = portrait?.size ? await preparePhoto(portrait, { maxEdge: 280 }) : null;
            if (owner !== userId) return;
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
            if (prepared) {
                setStatus("Загружаем портрет…");
                try {
                    unwrap(await client.storage.from("prints-portraits").upload(owner, prepared.blob,
                        { upsert: true, contentType: prepared.blob.type, cacheControl: "0" }));
                    unwrap(await client.from("prints_artist_profiles").update({ portrait_version: crypto.randomUUID() })
                        .eq("artist_id", owner).select("artist_id").single());
                } catch {
                    setStatus("Текст профиля сохранён. Не удалось подтвердить сохранение портрета. Попробуйте ещё раз.");
                    return;
                }
                if (owner !== userId) return;
                profileForm.elements.portrait.value = "";
            }
            await loadProfile(owner);
            if (owner !== userId) return;
            const nextSection = requestedSection() === "new-work" ? "new-work" : "works";
            window.history.replaceState(null, "", `#${nextSection}`);
            showSection(nextSection);
            setStatus("Профиль сохранён.");
            await refreshWorks(owner);
        }, "Не удалось сохранить профиль. Попробуйте ещё раз.");
    });

    function syncUploadFields() {
        const count = workForm.elements.photo.files.length;
        workForm.elements.photo.setCustomValidity(count > 50 ? "Выберите не более 50 файлов." : "");
        for (const field of [workForm.elements.title, workForm.elements.interior]) {
            field.disabled = count > 1;
            field.closest("label").hidden = count > 1;
        }
        document.querySelector("#upload-batch-note").hidden = count < 2;
    }
    workForm.elements.photo.onchange = syncUploadFields;
    workForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const owner = userId;
        const fields = new FormData(workForm);
        const files = fields.getAll("photo");
        if (!profile || !files.length || files.length > 50) return;
        const details = { category: fields.get("category"), description: fields.get("description").trim(), ...readOfferFields(fields) };
        const interior = fields.get("interior");
        run(event.submitter, async () => {
            const failures = [];
            let completed = 0;
            for (const [index, file] of files.entries()) {
                if (owner !== userId) return;
                setStatus(`Обработка ${index + 1} из ${files.length}: ${file.name}`);
                let work;
                try {
                    const title = files.length === 1 ? fields.get("title").trim()
                        : file.name.replace(/\.[^.]+$/, "").trim().slice(0, 120) || `Работа ${index + 1}`;
                    const photo = await preparePhoto(file);
                    const room = interior?.size ? await preparePhoto(interior, { interior: true }) : null;
                    if (owner !== userId) return;
                    work = unwrap(await client.from("prints_artworks").insert({ ...details, title, orientation: photo.orientation })
                        .select("id,artist_id").single());
                    await uploadPhoto(work, photo);
                    if (room) await uploadPhoto(work, room, true);
                    completed++;
                } catch {
                    failures.push(file.name + (work ? " (добавьте фото в сохранённом черновике)" : " (проверьте список перед повтором)"));
                }
            }
            if (owner !== userId) return;
            if (completed || files.length > 1) {
                workForm.reset();
                syncUploadFields();
                syncNewOffer();
                window.history.replaceState(null, "", "#works");
                showSection("works");
            }
            await refreshWorks(owner);
            setStatus(`Готово: ${completed} из ${files.length}.` + (failures.length ? " Не удалось завершить: " + failures.join(", ") : " Работы сохранены в черновиках."));
        }, "Не удалось завершить загрузку. Проверьте список работ.");
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
        portraitImage.hidden = true;
        portraitImage.removeAttribute("src");
        profileForm.reset();
        workForm.reset();
        syncUploadFields();
        updateSelection();
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

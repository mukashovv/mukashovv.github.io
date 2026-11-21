document.addEventListener("DOMContentLoaded", async () => {
    const shared = window.printsShared || {};
    let catalog = window.printsCatalog || [];
    const page = document.body.dataset.printsPage;
    const profileHandle = page === "catalog" ? new URLSearchParams(window.location.search).get("author") : null;
    let publicArtist;
    const normalizeSearch = (value) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const feature = document.querySelector("[data-gallery-feature]");
    if (feature) feature.hidden = Boolean(window.location.search);

    if (!catalog.length) {
        return;
    }

    const storageKeys = {
        favourites: "mukashov_prints_favourites",
        cart: "mukashov_prints_cart"
    };

    const defaultSizeId = shared.defaultSizeId || "50x70";
    const defaultFrameId = shared.defaultFrameId || "oak-slim";
    const priceFilter = shared.priceFilter || {};
    const defaultPriceMin = Number(priceFilter.min) || 20;
    const defaultPriceMax = Number(priceFilter.max) || 800;
    const priceStep = Number(priceFilter.step) || 5;
    const euroRate = Number(priceFilter.rate) || 95;

    const safeJsonParse = (value, fallback) => {
        try {
            return JSON.parse(value) || fallback;
        } catch (error) {
            return fallback;
        }
    };

    const readStorage = (key, fallback) => {
        try {
            return safeJsonParse(window.localStorage.getItem(key), fallback);
        } catch (error) {
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            return;
        }
    };

    let favourites = Array.isArray(readStorage(storageKeys.favourites, []))
        ? readStorage(storageKeys.favourites, [])
        : [];
    let cart = Array.isArray(readStorage(storageKeys.cart, []))
        ? readStorage(storageKeys.cart, [])
        : [];

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);

    const slugify = (value) => String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const artistFilterId = (work) => work.artistId || slugify(work.artist);
    const categoryLabel = (work) => shared.categories?.find((category) => category.id === work.category)?.label;
    const formatPrice = (value) => `${new Intl.NumberFormat("en-GB").format(value)} KGS`;
    const formatEuro = (value) => `${new Intl.NumberFormat("en-US").format(value)} €`;
    const findSize = (sizeId) => (shared.sizes || []).find((size) => size.id === sizeId);
    const findFrame = (frameId) => (shared.frames || []).find((frame) => frame.id === frameId);
    const getProductBySlug = (slug) => catalog.find((item) => item.slug === slug) || catalog.find((item) => !item.isArtistWork);
    const getGalleryImages = (product) => product.galleryImages?.filter(Boolean).length
        ? product.galleryImages.filter(Boolean)
        : [product.image].filter(Boolean);
    const getArtists = () => Array.from(
        new Map(
            catalog.map((product) => [artistFilterId(product), { id: artistFilterId(product), label: product.artist }])
        ).values()
    );
    const somToEuro = (value) => Math.round(Number(value || 0) / euroRate);
    const clampPrice = (value, fallback) => {
        const numericValue = Number(value);

        if (Number.isNaN(numericValue)) {
            return fallback;
        }

        return Math.min(defaultPriceMax, Math.max(defaultPriceMin, numericValue));
    };
    const normalizePriceRange = (minValue, maxValue, changedBound = "initial") => {
        let min = clampPrice(minValue, defaultPriceMin);
        let max = clampPrice(maxValue, defaultPriceMax);

        if (min > max - priceStep) {
            if (changedBound === "min") {
                max = Math.min(defaultPriceMax, min + priceStep);
            } else if (changedBound === "max") {
                min = Math.max(defaultPriceMin, max - priceStep);
            } else {
                min = defaultPriceMin;
                max = defaultPriceMax;
            }
        }

        if (min > max) {
            min = defaultPriceMin;
            max = defaultPriceMax;
        }

        return { min, max };
    };
    const getBasePrice = (product, sizeId) => {
        if (product.priceBySize[sizeId]) {
            return product.priceBySize[sizeId];
        }

        return Object.values(product.priceBySize)[0];
    };
    const getCardPrice = (product, sizeId) => formatPrice(getBasePrice(product, sizeId || defaultSizeId));
    const offerLabels = { original: "Original", print: "Print" };
    const artistPriceLabel = (product) => {
        const offers = product.offers || [];
        const prices = offers.filter((offer) => offer.available).map((offer) => offer.price);
        if (prices.length) {
            const prefix = new Set(prices).size > 1 ? "From " : "";
            return prefix + formatPrice(Math.min(...prices));
        }
        return offers.length ? "Out of stock" : product.city;
    };
    const isFavourite = (slug) => favourites.includes(slug);
    let productViewportSyncFrame = 0;
    let productViewportEventsBound = false;

    const cartItemKey = (item) => `${item.slug}::${item.sizeId}::${item.frameId}::${item.offerType || ""}`;
    const normalizeCartItem = (item) => ({
        slug: item.slug,
        offerType: item.offerType || "",
        sizeId: item.sizeId || defaultSizeId,
        frameId: item.frameId || defaultFrameId,
        quantity: Math.max(1, Number(item.quantity) || 1)
    });

    cart = cart.map(normalizeCartItem);

    const heartIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 21.35 10.55 20C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.01 6.01 0 0 1 16.5 3C19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
        </svg>
    `;

    const buildProductUrl = (slug, options = {}) => {
        const params = new URLSearchParams();
        params.set("slug", slug);

        if (options.sizeId) {
            params.set("size", options.sizeId);
        }

        return `./product.html?${params.toString()}`;
    };

    const buildCatalogQuery = (state) => {
        const params = new URLSearchParams();
        if (profileHandle) params.set("author", profileHandle);
        if (state.query) params.set("q", state.query);

        if (state.sortId && state.sortId !== "all") {
            params.set("sort", state.sortId);
        }

        if (state.categoryId && state.categoryId !== "all") {
            params.set("category", state.categoryId);
        }

        if (state.artistId && state.artistId !== "all") {
            params.set("artist", state.artistId);
        }

        if (state.priceMin !== defaultPriceMin) {
            params.set("price_min", state.priceMin);
        }

        if (state.priceMax !== defaultPriceMax) {
            params.set("price_max", state.priceMax);
        }

        if (state.orientationId && state.orientationId !== "all") {
            params.set("orientation", state.orientationId);
        }

        if (state.colourId && state.colourId !== "all") {
            params.set("colour", state.colourId);
        }

        if (state.collectionId && state.collectionId !== "all") {
            params.set("collection", state.collectionId);
        }

        if (state.sizeId && state.sizeId !== defaultSizeId) {
            params.set("size", state.sizeId);
        }

        return params.toString();
    };

    const checkout = async (button, items) => {
        try {
            const order = await import("../../build/js/checkout.js");
            await order.checkout(button, items);
        } catch {
            window.alert("Could not open checkout. Refresh the page and try again.");
        }
    };

    const getInfoSections = (product) => {
        const sections = {};

        if (Array.isArray(product.intro) && product.intro.length) {
            sections.about = {
                navLabel: "About",
                eyebrow: "About",
                title: "About the artwork",
                type: "paragraphs",
                content: product.intro
            };
        }

        sections.framing = {
            navLabel: "Framing",
            eyebrow: "Framing",
            title: "Framing",
            type: "list",
            content: shared.included || []
        };

        sections.details = {
            navLabel: "Details",
            eyebrow: "Details",
            title: "Order details",
            type: "list",
            content: shared.framingNotes || []
        };

        return sections;
    };

    const buildInfoMenu = (slug, activeSection, sectionsMap) => {
        const sections = Object.entries(sectionsMap || {}).map(([id, section]) => ({
            id,
            label: section.navLabel
        }));

        return `
            <div class="container footer-links-bar__inner">
                <nav class="footer-links-nav" aria-label="Additional information">
                    ${sections.map((section) => `
                        <a class="footer-links-nav__link${activeSection === section.id ? " is-active" : ""}" href="./info.html?slug=${slug}&section=${section.id}">
                            ${section.label}
                        </a>
                    `).join("")}
                </nav>
            </div>
        `;
    };

    const buildFavouriteButton = (slug) => `
        <button class="favorite-toggle" type="button" data-favourite-toggle data-slug="${escapeHtml(slug)}" aria-pressed="${String(isFavourite(slug))}" aria-label="Add to favourites">
            ${heartIcon}
        </button>
    `;

    const syncProductViewportHeight = () => {
        const galleryElement = document.querySelector(".product-gallery");
        const previewElement = document.querySelector(".product-preview");

        if (!galleryElement || !previewElement) {
            return;
        }

        const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
        const galleryTop = Math.max(galleryElement.getBoundingClientRect().top, 0);
        const previewStyles = window.getComputedStyle(previewElement);
        const previewPadding = (parseFloat(previewStyles.paddingTop) || 0)
            + (parseFloat(previewStyles.paddingBottom) || 0);
        const bottomOffset = window.innerWidth <= 760 ? 14 : 20;
        const availableHeight = Math.floor(viewportHeight - galleryTop - previewPadding - bottomOffset);

        if (availableHeight > 0) {
            galleryElement.style.setProperty("--product-preview-height", `${availableHeight}px`);
        }
    };

    const queueProductViewportHeightSync = () => {
        window.cancelAnimationFrame(productViewportSyncFrame);
        productViewportSyncFrame = window.requestAnimationFrame(syncProductViewportHeight);
    };

    const bindProductViewportEvents = () => {
        if (productViewportEventsBound) {
            return;
        }

        window.addEventListener("resize", queueProductViewportHeightSync, { passive: true });

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", queueProductViewportHeightSync, { passive: true });
        }

        window.addEventListener("load", queueProductViewportHeightSync, { once: true });
        productViewportEventsBound = true;
    };

    const orderDetails = (item) => {
        const product = catalog.find((work) => work.slug === item.slug);
        if (!product) return null;
        const size = findSize(item.sizeId) || findSize(defaultSizeId);
        const frame = findFrame(item.frameId) || findFrame(defaultFrameId);
        const offer = product.offers?.find((entry) => entry.type === item.offerType);
        const unitPrice = product.isArtistWork ? (offer?.price ?? 0)
            : getBasePrice(product, item.sizeId) + (frame?.surcharge || 0);

        return {
            ...item,
            offerLabel: offerLabels[item.offerType],
            available: !product.isArtistWork || Boolean(offer?.available),
            limit: offer?.type === "original" ? 1 : offer?.stock,
            product,
            size,
            frame,
            unitPrice,
            totalPrice: unitPrice * item.quantity
        };
    };
    const getCartDetails = () => cart.map(orderDetails).filter(Boolean);

    const getCartCount = () => getCartDetails().reduce((sum, item) => sum + item.quantity, 0);
    const getCartTotal = () => getCartDetails().reduce((sum, item) => sum + item.totalPrice, 0);

    const ensureDrawers = () => {
        if (document.querySelector("[data-drawer-overlay]")) {
            return;
        }

        document.body.insertAdjacentHTML("beforeend", `
            <div class="drawer-overlay" data-drawer-overlay></div>

            <aside class="drawer-panel" data-drawer-panel="favourites" aria-hidden="true">
                <div class="drawer-panel__header">
                    <div class="drawer-panel__title-row">
                        <p class="drawer-panel__title">Favourites</p>
                        <button class="drawer-close" type="button" data-drawer-close>Close</button>
                    </div>
                </div>
                <div class="drawer-panel__body" data-favourites-body></div>
                <div class="drawer-panel__footer" data-favourites-footer></div>
            </aside>

            <aside class="drawer-panel" data-drawer-panel="cart" aria-hidden="true">
                <div class="drawer-panel__header">
                    <div class="drawer-panel__title-row">
                        <p class="drawer-panel__title">Cart</p>
                        <button class="drawer-close" type="button" data-drawer-close>Close</button>
                    </div>
                </div>
                <div class="drawer-panel__body" data-cart-body></div>
                <div class="drawer-panel__footer" data-cart-footer></div>
            </aside>
        `);
    };

    ensureDrawers();

    const overlay = document.querySelector("[data-drawer-overlay]");
    const drawerPanels = Array.from(document.querySelectorAll("[data-drawer-panel]"));

    const closeDrawers = () => {
        document.body.classList.remove("drawer-open");
        overlay.classList.remove("is-open");
        drawerPanels.forEach((panel) => {
            panel.classList.remove("is-open");
            panel.setAttribute("aria-hidden", "true");
        });
    };

    const openDrawer = (name) => {
        document.body.classList.add("drawer-open");
        overlay.classList.add("is-open");

        drawerPanels.forEach((panel) => {
            const isTarget = panel.dataset.drawerPanel === name;
            panel.classList.toggle("is-open", isTarget);
            panel.setAttribute("aria-hidden", String(!isTarget));
        });
    };

    const updateHeaderCounts = () => {
        document.querySelectorAll("[data-favourites-count]").forEach((node) => {
            node.textContent = favourites.length || "";
        });

        const cartCount = getCartCount();
        document.querySelectorAll("[data-cart-count]").forEach((node) => {
            node.textContent = cartCount || "";
        });
    };

    const updateFavouriteButtons = () => {
        document.querySelectorAll("[data-favourite-toggle]").forEach((button) => {
            const slug = button.dataset.slug;
            const active = isFavourite(slug);
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
            button.innerHTML = heartIcon;
        });
    };

    const renderDrawers = () => {
        const favouritesBody = document.querySelector("[data-favourites-body]");
        const favouritesFooter = document.querySelector("[data-favourites-footer]");
        const cartBody = document.querySelector("[data-cart-body]");
        const cartFooter = document.querySelector("[data-cart-footer]");

        const favouriteProducts = favourites.map((slug) => catalog.find((work) => work.slug === slug)).filter(Boolean);
        const cartDetails = getCartDetails();

        if (favouritesBody) {
            favouritesBody.innerHTML = favouriteProducts.length
                ? favouriteProducts.map((product) => `
                    <article class="drawer-item">
                        <a class="drawer-item__media" href="${buildProductUrl(product.slug)}">
                            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)} — ${escapeHtml(product.artist)}">
                        </a>
                        <div class="drawer-item__body">
                            <p class="drawer-item__artist">${escapeHtml(product.artist)}</p>
                            <h3 class="drawer-item__name"><a href="${buildProductUrl(product.slug)}">${escapeHtml(product.title)}</a></h3>
                            <p class="drawer-item__meta">${product.isArtistWork ? escapeHtml(artistPriceLabel(product)) : `From ${getCardPrice(product, defaultSizeId)}`}</p>
                            <div class="drawer-item__actions">
                                <button class="drawer-item__button" type="button" data-remove-favourite data-slug="${product.slug}">Remove</button>
                            </div>
                        </div>
                    </article>
                `).join("")
                : `<p class="drawer-empty">Your saved artworks will appear here. Browse the catalogue to find your favourites.</p>`;
        }

        if (favouritesFooter) {
            favouritesFooter.innerHTML = favouriteProducts.length
                ? `<a class="button button--solid" href="./">Continue Browsing</a>`
                : `<a class="button button--line" href="./">Open Catalog</a>`;
        }

        if (cartBody) {
            cartBody.innerHTML = cartDetails.length
                ? cartDetails.map((item) => `
                    <article class="drawer-item">
                        <a class="drawer-item__media" href="${buildProductUrl(item.product.slug, { sizeId: item.sizeId })}">
                            <img src="${item.product.image}" alt="${escapeHtml(item.product.title)} — ${escapeHtml(item.product.artist)}">
                        </a>
                        <div class="drawer-item__body">
                            <p class="drawer-item__artist">${escapeHtml(item.product.artist)}</p>
                            <h3 class="drawer-item__name"><a href="${buildProductUrl(item.product.slug, { sizeId: item.sizeId })}">${escapeHtml(item.product.title)}</a></h3>
                            <p class="drawer-item__meta">${item.offerLabel ? item.offerLabel + " / " : ""}${item.size?.label || ""} / ${item.frame?.label || ""}</p>
                            <p class="drawer-item__meta">Quantity: ${item.quantity} / ${formatPrice(item.totalPrice)}</p>
                            <div class="drawer-item__actions">
                                <button class="drawer-item__button" type="button" data-cart-adjust="decrease" data-cart-key="${cartItemKey(item)}">- 1</button>
                                <button class="drawer-item__button" type="button" data-cart-adjust="increase" data-cart-key="${cartItemKey(item)}">+ 1</button>
                                <button class="drawer-item__button" type="button" data-remove-cart data-cart-key="${cartItemKey(item)}">Remove</button>
                            </div>
                        </div>
                    </article>
                `).join("")
                : `<p class="drawer-empty">Your cart is empty. Add a print with your chosen size and frame.</p>`;
        }

        if (cartFooter) {
            cartFooter.innerHTML = cartDetails.length
                ? `
                    <p class="drawer-total">
                        <span>Subtotal</span>
                        <strong>${formatPrice(getCartTotal())}</strong>
                    </p>
                    <button type="button" class="button button--solid" data-checkout>Order via WhatsApp</button>
                `
                : `<a class="button button--line" href="./">Open Catalog</a>`;
            cartFooter.querySelector("[data-checkout]")?.addEventListener("click", (event) => {
                const unavailable = cartDetails.some((item) => {
                    const count = cartDetails.filter((entry) => entry.slug === item.slug && entry.offerType === item.offerType)
                        .reduce((sum, entry) => sum + entry.quantity, 0);
                    return !item.available || (item.limit != null && count > item.limit);
                });
                if (unavailable) {
                    window.alert("Check quantities. An item is sold out or exceeds available stock.");
                    return;
                }
                checkout(event.currentTarget, cartDetails);
            });
        }
    };

    const renderGlobalUi = () => {
        updateHeaderCounts();
        updateFavouriteButtons();
        renderDrawers();
    };

    const saveFavourites = () => writeStorage(storageKeys.favourites, favourites);
    const saveCart = () => writeStorage(storageKeys.cart, cart);

    const toggleFavourite = (slug) => {
        if (isFavourite(slug)) {
            favourites = favourites.filter((item) => item !== slug);
        } else {
            favourites = [...favourites, slug];
        }

        saveFavourites();
        renderGlobalUi();
    };

    const addToCart = (payload) => {
        const nextItem = normalizeCartItem(payload);
        const existing = cart.find((item) => cartItemKey(item) === cartItemKey(nextItem));

        if (existing) {
            existing.quantity += nextItem.quantity;
        } else {
            cart = [...cart, nextItem];
        }

        saveCart();
        renderGlobalUi();
        openDrawer("cart");
    };

    const adjustCartItem = (key, delta) => {
        cart = cart.map(normalizeCartItem).flatMap((item) => {
            if (cartItemKey(item) !== key) {
                return [item];
            }

            const nextQuantity = item.quantity + delta;
            return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
        });

        saveCart();
        renderGlobalUi();
    };

    const removeCartItem = (key) => {
        cart = cart.filter((item) => cartItemKey(item) !== key);
        saveCart();
        renderGlobalUi();
    };

    const renderProductRecommendations = (product, sizeId) => {
        const others = catalog.filter((work) => work.slug !== product.slug);
        const sameAuthor = (work) => work.artistId && product.artistId
            ? work.artistId === product.artistId
            : artistFilterId(work) === artistFilterId(product) || Boolean(work.artist && work.artist === product.artist);
        const affinity = (work) =>
            4 * Number(Boolean(product.category && work.category === product.category))
            + 2 * Number(Boolean(product.collection && work.collection === product.collection))
            + Number(Boolean(product.orientation && work.orientation === product.orientation));

        const authorWorks = others.filter(sameAuthor);
        const relatedWorks = others.filter((work) => !sameAuthor(work))
            .sort((first, second) => affinity(second) - affinity(first));

        for (const [id, works] of [["authorWorks", authorWorks], ["relatedWorks", relatedWorks]]) {
            const section = document.getElementById(id);
            if (!section) continue;
            section.hidden = !works.length;
            section.querySelector(".prints-grid").innerHTML = works.slice(0, 4)
                .map((work) => buildCardMarkup(work, sizeId)).join("");
        }
    };

    const renderArtworkImage = (product, interior = false, lazy = false) => {
        const loading = lazy ? ' loading="lazy"' : "";
        if (interior && product.hoverImage) {
            return `<span class="artwork-scene artwork-scene--photo"><img${loading} src="${escapeHtml(product.hoverImage)}" alt=""></span>`;
        }
        const scene = interior ? ` artwork-scene--interior artwork-scene--${product.interior}` : "";
        return `<span class="artwork-scene${scene}"><span class="artwork-scene__mount">
            <img${loading} src="${escapeHtml(product.image)}" alt="">
        </span></span>`;
    };

    const buildCardMarkup = (product, sizeId) => {
        const cardUrl = buildProductUrl(product.slug, { sizeId });
        const hoverImage = product.hoverImage || product.image;
        const size = findSize(sizeId) || findSize(defaultSizeId) || shared.sizes?.[0];

        return `
            <article class="print-card">
                <div class="print-card__media-wrap">
                    ${buildFavouriteButton(product.slug)}
                    <a class="print-card__media" href="${cardUrl}" aria-label="Open ${escapeHtml(product.title)}">
                        ${product.isArtistWork ? `
                            <span class="print-card__image print-card__image--base">${renderArtworkImage(product, false, true)}</span>
                            <span class="print-card__image print-card__image--hover" aria-hidden="true">${renderArtworkImage(product, true, true)}</span>`
                            : `<img loading="lazy" class="print-card__image print-card__image--base" src="${product.image}" alt="${escapeHtml(product.title)} — ${escapeHtml(product.artist)}">
                            <img loading="lazy" class="print-card__image print-card__image--hover" src="${hoverImage}" alt="" aria-hidden="true">`}
                    </a>
                </div>
                <div class="print-card__body">
                    <p class="print-card__artist">${escapeHtml(product.artist)}</p>
                    <h3 class="print-card__title"><a href="${cardUrl}">${escapeHtml(product.title)}</a></h3>
                    <div class="print-card__meta">
                        ${product.isArtistWork
                            ? `<span>${escapeHtml(artistPriceLabel(product))}</span><span>${escapeHtml(categoryLabel(product))}</span>`
                            : `<span>From ${getCardPrice(product, sizeId)}</span>
                               <span>${size?.shortLabel || "50 x 70"} / 4 frame options</span>`}
                    </div>
                </div>
            </article>
        `;
    };

    const getInitialCatalogState = () => {
        const params = new URLSearchParams(window.location.search);
        const sortId = (shared.sortTabs || []).some((tab) => tab.id === params.get("sort"))
            ? params.get("sort")
            : "all";
        const categoryId = (shared.categories || []).some((category) => category.id === params.get("category"))
            ? params.get("category")
            : "all";
        const requestedArtist = params.get("artist");
        const artists = getArtists();
        const matchedArtist = artists.find((artist) => artist.id === requestedArtist)
            || artists.find((artist) => slugify(artist.label) === requestedArtist);
        const artistId = publicArtist ? "all" : matchedArtist?.id || "all";
        const initialPriceRange = normalizePriceRange(
            params.get("price_min"),
            params.get("price_max"),
            "initial"
        );
        const orientationId = (shared.orientations || []).some((item) => item.id === params.get("orientation"))
            ? params.get("orientation")
            : "all";
        const colourId = (shared.colours || []).some((item) => item.id === params.get("colour"))
            ? params.get("colour")
            : "all";
        const collectionId = (shared.collections || []).some((item) => item.id === params.get("collection"))
            ? params.get("collection")
            : "all";
        const sizeId = (shared.sizes || []).some((size) => size.id === params.get("size"))
            ? params.get("size")
            : defaultSizeId;

        return {
            query: (params.get("q") || "").slice(0, 100).trim(),
            sortId,
            categoryId,
            artistId,
            priceMin: initialPriceRange.min,
            priceMax: initialPriceRange.max,
            orientationId,
            colourId,
            collectionId,
            sizeId
        };
    };

    const getCatalogProducts = (state) => {
        let items = publicArtist
            ? catalog.filter((work) => work.artistId === publicArtist.artistId)
            : [...catalog];

        if (state.query) {
            const terms = normalizeSearch(state.query).split(/\s+/);
            items = items.filter((work) => {
                const searchable = normalizeSearch([
                    work.title, work.artist, categoryLabel(work), work.slug.replaceAll("-", " ")
                ].join(" "));
                return terms.every((term) => searchable.includes(term));
            });
        }

        if (state.sortId === "new") {
            items.sort((a, b) => {
                if (a.isArtistWork && b.isArtistWork) return new Date(b.createdAt) - new Date(a.createdAt);
                if (a.isArtistWork || b.isArtistWork) return Number(Boolean(b.isArtistWork)) - Number(Boolean(a.isArtistWork));
                return b.releaseRank - a.releaseRank;
            });
        }

        if (state.sortId === "popular") {
            items.sort((a, b) => (b.popularityRank || 0) - (a.popularityRank || 0));
        }

        if (state.sortId === "large") {
            items = items.filter((item) => item.isLargeScale);
        }

        if (state.categoryId !== "all") {
            items = items.filter((item) => item.category === state.categoryId);
        }

        if (state.artistId !== "all") {
            items = items.filter((item) => artistFilterId(item) === state.artistId);
        }

        items = items.filter((item) => {
            const isInRange = (price) => {
                const euroPrice = somToEuro(price);
                return euroPrice >= state.priceMin && euroPrice <= state.priceMax;
            };
            if (!item.isArtistWork) return isInRange(getBasePrice(item, state.sizeId));
            if (state.priceMin === defaultPriceMin && state.priceMax === defaultPriceMax) return true;
            return item.offers?.some((offer) => offer.available && isInRange(offer.price));
        });

        if (state.orientationId !== "all") {
            items = items.filter((item) => item.orientation === state.orientationId);
        }

        if (state.colourId !== "all") {
            items = items.filter((item) => item.colour === state.colourId);
        }

        if (state.collectionId !== "all") {
            items = items.filter((item) => item.collection === state.collectionId);
        }

        return items;
    };

    const syncCatalogUrl = (state) => {
        const queryString = buildCatalogQuery(state);
        const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        window.history.replaceState({}, "", nextUrl + (window.location.hash || ""));
    };

    const buildFilterDropdown = ({ label, key, selectedId, options, optionLabel, arrow = "down" }) => `
        <details class="filter-dropdown${selectedId !== "all" && selectedId !== defaultSizeId ? " is-active" : ""}">
            <summary class="filter-dropdown__summary">
                <span>${label}</span>
                <span class="filter-dropdown__arrow filter-dropdown__arrow--${arrow}" aria-hidden="true">
                    <svg viewBox="0 0 16 16" focusable="false">
                        <path d="${arrow === "up" ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"}"></path>
                    </svg>
                </span>
            </summary>
            <div class="filter-dropdown__menu">
                ${options.map((option) => `
                    <button
                        class="filter-dropdown__option${selectedId === option.id ? " is-active" : ""}"
                        type="button"
                        data-filter-key="${key}"
                        data-filter-value="${option.id}"
                    >
                        ${escapeHtml(optionLabel(option))}
                    </button>
                `).join("")}
            </div>
        </details>
    `;

    const buildPriceDropdown = (state) => {
        const start = ((state.priceMin - defaultPriceMin) / (defaultPriceMax - defaultPriceMin)) * 100;
        const end = ((state.priceMax - defaultPriceMin) / (defaultPriceMax - defaultPriceMin)) * 100;
        const isActive = state.priceMin !== defaultPriceMin || state.priceMax !== defaultPriceMax;

        return `
            <details class="filter-dropdown filter-dropdown--price${isActive ? " is-active" : ""}">
                <summary class="filter-dropdown__summary">
                    <span>Price</span>
                    <span class="filter-dropdown__arrow" aria-hidden="true">
                        <svg viewBox="0 0 16 16" focusable="false">
                            <path d="m4 6 4 4 4-4"></path>
                        </svg>
                    </span>
                </summary>
                <div class="filter-dropdown__menu filter-dropdown__menu--price">
                    <div class="filter-price" data-price-filter style="--range-start:${start}%; --range-end:${end}%;">
                        <div class="filter-price__values">
                            <span class="filter-price__value" data-price-label="min">${formatEuro(state.priceMin)}</span>
                            <span class="filter-price__value" data-price-label="max">${formatEuro(state.priceMax)}</span>
                        </div>
                        <div class="filter-price__slider">
                            <div class="filter-price__track"></div>
                            <div class="filter-price__progress"></div>
                            <input
                                class="filter-price__input filter-price__input--min"
                                type="range"
                                min="${defaultPriceMin}"
                                max="${defaultPriceMax}"
                                step="${priceStep}"
                                value="${state.priceMin}"
                                data-price-input="min"
                            >
                            <input
                                class="filter-price__input filter-price__input--max"
                                type="range"
                                min="${defaultPriceMin}"
                                max="${defaultPriceMax}"
                                step="${priceStep}"
                                value="${state.priceMax}"
                                data-price-input="max"
                            >
                        </div>
                        <div class="filter-price__limits">
                            <span>${formatEuro(defaultPriceMin)}</span>
                            <span>${formatEuro(defaultPriceMax)}</span>
                        </div>
                    </div>
                </div>
            </details>
        `;
    };

    const syncPriceFilterUi = (state) => {
        const priceFilterNode = document.querySelector("[data-price-filter]");

        if (!priceFilterNode) {
            return;
        }

        const start = ((state.priceMin - defaultPriceMin) / (defaultPriceMax - defaultPriceMin)) * 100;
        const end = ((state.priceMax - defaultPriceMin) / (defaultPriceMax - defaultPriceMin)) * 100;
        const minInput = priceFilterNode.querySelector("[data-price-input='min']");
        const maxInput = priceFilterNode.querySelector("[data-price-input='max']");
        const minLabel = priceFilterNode.querySelector("[data-price-label='min']");
        const maxLabel = priceFilterNode.querySelector("[data-price-label='max']");
        const dropdown = priceFilterNode.closest(".filter-dropdown");
        const isActive = state.priceMin !== defaultPriceMin || state.priceMax !== defaultPriceMax;

        priceFilterNode.style.setProperty("--range-start", `${start}%`);
        priceFilterNode.style.setProperty("--range-end", `${end}%`);

        if (minInput) {
            minInput.value = String(state.priceMin);
        }

        if (maxInput) {
            maxInput.value = String(state.priceMax);
        }

        if (minLabel) {
            minLabel.textContent = formatEuro(state.priceMin);
        }

        if (maxLabel) {
            maxLabel.textContent = formatEuro(state.priceMax);
        }

        if (dropdown) {
            dropdown.classList.toggle("is-active", isActive);
        }
    };

    const renderFilterWaypoint = (state) => {
        const waypoint = document.querySelector("#filterWaypoint");

        if (!waypoint) {
            return;
        }

        const scrollLeft = waypoint.querySelector(".filter-waypoint__inner")?.scrollLeft || 0;
        waypoint.innerHTML = `
            <div class="container filter-waypoint__inner">
                ${buildFilterDropdown({
                    label: "Sort By",
                    key: "sort",
                    selectedId: state.sortId,
                    options: shared.sortTabs || [],
                    optionLabel: (option) => option.label
                })}
                ${buildFilterDropdown({
                    label: "Size",
                    key: "size",
                    selectedId: state.sizeId,
                    options: shared.sizes || [],
                    optionLabel: (option) => option.shortLabel || option.label
                })}
                ${buildFilterDropdown({
                    label: "Orientation",
                    key: "orientation",
                    selectedId: state.orientationId,
                    options: shared.orientations || [],
                    optionLabel: (option) => option.label
                })}
                ${buildPriceDropdown(state)}
                ${buildFilterDropdown({
                    label: "Colour",
                    key: "colour",
                    selectedId: state.colourId,
                    options: shared.colours || [],
                    optionLabel: (option) => option.label
                })}
                ${publicArtist ? "" : buildFilterDropdown({
                    label: "Artist",
                    key: "artist",
                    selectedId: state.artistId,
                    options: [{ id: "all", label: "All Artists" }, ...getArtists()],
                    optionLabel: (option) => option.label
                })}
                ${buildFilterDropdown({
                    label: "Category",
                    key: "category",
                    selectedId: state.categoryId,
                    options: shared.categories || [],
                    optionLabel: (option) => option.label
                })}
                ${buildFilterDropdown({
                    label: "Collection",
                    key: "collection",
                    selectedId: state.collectionId,
                    options: shared.collections || [],
                    optionLabel: (option) => option.label
                })}
            </div>
        `;
        if (scrollLeft) waypoint.querySelector(".filter-waypoint__inner").scrollLeft = scrollLeft;
    };

    const renderCatalogGrid = (state) => {
        const grid = document.querySelector("#printsGrid");
        const results = document.querySelector("#catalogResults");

        const products = getCatalogProducts(state);
        if (results) results.textContent = `Results: ${products.length}`;

        if (grid) {
            grid.innerHTML = products.length
                ? products.map((product) => buildCardMarkup(product, state.sizeId)).join("")
                : `<p class="catalog-empty">No works match these filters. Try removing a filter or widening the price range.</p>`;
            window.prepareGalleryCards?.(grid);
        }
    };

    const renderCatalogPage = () => {
        const grid = document.querySelector("#printsGrid");
        const state = getInitialCatalogState();
        let lastScrollY = window.scrollY;
        const searchForm = document.querySelector(".gallery-search");
        const searchInput = searchForm?.querySelector("input");

        if (searchInput) searchInput.value = state.query;
        searchForm?.addEventListener("submit", (event) => event.preventDefault());
        searchInput?.addEventListener("input", () => {
            state.query = searchInput.value.trim();
            renderProducts();
        });

        const renderProducts = () => {
            renderCatalogGrid(state);
            syncCatalogUrl(state);
            renderGlobalUi();
        };

        const render = () => {
            renderFilterWaypoint(state);
            renderProducts();
            syncPriceFilterUi(state);
        };

        const syncWaypointVisibility = () => {
            const waypoint = document.querySelector("#filterWaypoint");

            if (!waypoint) {
                return;
            }

            const currentScrollY = window.scrollY;
            const scrolledDown = currentScrollY > lastScrollY + 6;
            const scrolledUp = currentScrollY < lastScrollY - 6;

            const approachingGrid = grid && grid.getBoundingClientRect().top > 0;

            if (window.innerWidth <= 760 || approachingGrid || currentScrollY < 120 || scrolledUp) {
                waypoint.classList.remove("is-hidden");
            } else if (scrolledDown) {
                waypoint.classList.add("is-hidden");
                document.querySelectorAll(".filter-dropdown[open]").forEach((dropdown) => {
                    dropdown.open = false;
                });
            }

            lastScrollY = currentScrollY;
        };

        window.addEventListener("scroll", syncWaypointVisibility, { passive: true });

        document.addEventListener("click", (event) => {
            const filterSummary = event.target.closest(".filter-dropdown__summary");
            if (filterSummary) {
                document.querySelectorAll(".filter-dropdown[open]").forEach((dropdown) => {
                    if (dropdown !== filterSummary.parentElement) dropdown.open = false;
                });
            }

            const filterButton = event.target.closest("[data-filter-key]");

            if (filterButton) {
                const key = filterButton.dataset.filterKey;
                const value = filterButton.dataset.filterValue;

                if (key === "sort") {
                    state.sortId = value;
                }

                if (key === "size") {
                    state.sizeId = value;
                }

                if (key === "artist") {
                    state.artistId = value;
                }

                if (key === "category") {
                    state.categoryId = value;
                }

                if (key === "orientation") {
                    state.orientationId = value;
                }

                if (key === "colour") {
                    state.colourId = value;
                }

                if (key === "collection") {
                    state.collectionId = value;
                }

                const parentDropdown = filterButton.closest(".filter-dropdown");

                if (parentDropdown) {
                    parentDropdown.open = false;
                }

                render();
            }
        });

        document.addEventListener("input", (event) => {
            const priceInput = event.target.closest("[data-price-input]");

            if (!priceInput) {
                return;
            }

            const nextRange = normalizePriceRange(
                priceInput.dataset.priceInput === "min" ? priceInput.value : state.priceMin,
                priceInput.dataset.priceInput === "max" ? priceInput.value : state.priceMax,
                priceInput.dataset.priceInput
            );

            state.priceMin = nextRange.min;
            state.priceMax = nextRange.max;

            syncPriceFilterUi(state);
            renderProducts();
        });

        render();
        syncWaypointVisibility();
    };

    const renderProductOptions = (sizes, initialSizeId) => `
        <div class="option-group">
            <div class="option-group__label-row">
                <label class="option-group__label" for="product-size">Size</label>
                <span class="option-group__hint" data-role="size-hint"></span>
            </div>
            <select class="select-field" id="product-size" data-role="size-select">
                ${sizes.map((size) => `<option value="${size.id}"${size.id === initialSizeId ? " selected" : ""}>${size.label}</option>`).join("")}
            </select>
        </div>
        <div class="option-group">
            <div class="option-group__label-row">
                <label class="option-group__label" for="product-frame">Frame</label>
                <span class="option-group__hint" data-role="frame-hint"></span>
            </div>
            <select class="select-field" id="product-frame" data-role="frame-select">
                ${(shared.frames || []).map((frame) => `<option value="${frame.id}"${frame.id === defaultFrameId ? " selected" : ""}>${frame.label}</option>`).join("")}
            </select>
            <div class="frame-swatches" role="group" aria-label="Frame colour">
                ${(shared.frames || []).map((frame) => `
                    <button class="frame-swatch" type="button" data-product-frame="${frame.id}"
                        aria-label="${escapeHtml(frame.label)}" title="${escapeHtml(frame.label)}"
                        aria-pressed="${frame.id === defaultFrameId}">
                        <span class="frame-swatch__dot" style="--swatch: ${frame.swatch}" aria-hidden="true"></span>
                    </button>`).join("")}
            </div>
        </div>`;

    const bindFrameSwatches = (summary, select) => {
        if (!select) return;
        const buttons = Array.from(summary.querySelectorAll("[data-product-frame]"));
        const sync = () => buttons.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.productFrame === select.value));
        });
        select.addEventListener("change", sync);
        buttons.forEach((button) => button.addEventListener("click", () => {
            select.value = button.dataset.productFrame;
            select.dispatchEvent(new Event("change"));
        }));
        sync();
    };

    const renderProductDetails = (product) => `
        <div class="product-details">
            ${product.summary ? `<details>
                <summary>About the artwork</summary>
                <p class="artwork-description">${escapeHtml(product.summary)}</p>
            </details>` : ""}
            ${!product.isArtistWork && shared.included?.length ? `<details>
                <summary>Framing</summary>
                <ul>${shared.included.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </details>` : ""}
            <details>
                <summary>Delivery</summary>
                <p>Delivery costs and timing are agreed when you place your order.</p>
            </details>
        </div>`;



    const applyFramePreview = (preview, frame) => {
        if (preview && frame) preview.style.setProperty("--preview-frame-color", frame.swatch);
    };

    const renderOfferDetails = (offer) => `
        <div class="product-panel__price-row"><span>${offerLabels[offer.type]}</span><strong>${formatPrice(offer.price)}</strong></div>`;

    const renderArtistProduct = (product, gallery, summary, requestedSizeId) => {
        document.title = `${product.title} — Mukashov Gallery`;
        gallery.innerHTML = `
            <div class="product-gallery artwork-product-gallery" aria-label="Artwork images">
                <div class="product-gallery__thumbs">
                    <button type="button" class="product-gallery__thumb is-active" aria-label="Artwork" aria-pressed="true"><img src="${escapeHtml(product.image)}" alt=""></button>
                    <button type="button" class="product-gallery__thumb" aria-label="Artwork in a room" aria-pressed="false">${renderArtworkImage(product, true)}</button>
                </div>
                <div class="artwork-product-preview" role="img" aria-label="${escapeHtml(product.title)}">${renderArtworkImage(product)}</div>
            </div>`;
        const offers = product.offers || [];
        const initialOffer = offers.find((offer) => offer.available) || offers[0];
        const initialSizeId = findSize(requestedSizeId)?.id || defaultSizeId;
        summary.innerHTML = `
            <div class="product-panel">
                <div class="product-panel__head">
                    <div>
                        <p class="eyebrow">${escapeHtml(categoryLabel(product))}</p>
                        <h1>${escapeHtml(product.title)}</h1>
                        <p class="product-panel__artist">${escapeHtml(product.artist)}</p>
                    </div>
                    ${buildFavouriteButton(product.slug)}
                </div>
                ${offers.length > 1 ? `
                    <label class="option-group">Artwork option
                        <select class="select-field" data-artwork-offer>
                            ${offers.map((offer) => `<option value="${offer.type}"${offer === initialOffer ? " selected" : ""}>${offerLabels[offer.type]}</option>`).join("")}
                        </select>
                    </label>` : ""}
                ${initialOffer ? `<div class="artwork-offer-details" data-artwork-offer-details aria-live="polite">${renderOfferDetails(initialOffer)}</div>` : ""}
                ${renderProductOptions(shared.sizes || [], initialSizeId)}
                <div class="summary-actions">
                    ${initialOffer ? `<button type="button" class="button button--solid" data-art-cart>Add to cart</button>
                    <button type="button" class="button button--line" data-art-order>Order via WhatsApp</button>` : ""}
                    <a class="button button--line" data-author-profile href="./?artist=${encodeURIComponent(artistFilterId(product))}">More from this artist</a>
                    <a class="button button--ghost" href="./">Catalogue</a>
                </div>
                ${renderProductDetails(product)}
            </div>`;
        const offerSelector = summary.querySelector("[data-artwork-offer]");
        offerSelector?.addEventListener("change", () => {
            const offer = offers.find((entry) => entry.type === offerSelector.value);
            summary.querySelector("[data-artwork-offer-details]").innerHTML = renderOfferDetails(offer);
        });
        const preview = gallery.querySelector(".artwork-product-preview");
        const thumbs = Array.from(gallery.querySelectorAll(".product-gallery__thumb"));
        let isInterior = false;
        const showArtwork = (interior) => {
            isInterior = interior;
            preview.innerHTML = renderArtworkImage(product, interior);
            preview.setAttribute("aria-label", interior ? `${product.title} in a room` : product.title);
            thumbs.forEach((thumb, index) => {
                const active = index === Number(interior);
                thumb.classList.toggle("is-active", active);
                thumb.setAttribute("aria-pressed", String(active));
            });
        };
        thumbs.forEach((button, index) => button.addEventListener("click", () => showArtwork(index === 1)));

        const sizeSelect = summary.querySelector("[data-role='size-select']");
        const frameSelect = summary.querySelector("[data-role='frame-select']");
        const sizeHint = summary.querySelector("[data-role='size-hint']");
        const frameHint = summary.querySelector("[data-role='frame-hint']");
        const updateSize = (sizeId) => {
            sizeHint.textContent = findSize(sizeId)?.note || "";
        };
        const updateFrame = (frameId) => {
            const frame = findFrame(frameId);
            if (!frame) return;
            applyFramePreview(preview, frame);
            frameHint.textContent = frame.description;
        };
        if (initialOffer) {
            const cartButton = summary.querySelector("[data-art-cart]");
            const orderButton = summary.querySelector("[data-art-order]");
            const selection = () => ({ slug: product.slug, sizeId: sizeSelect.value, frameId: frameSelect.value,
                offerType: offerSelector?.value || initialOffer.type, quantity: 1 });
            const updateAvailability = () => {
                const available = orderDetails(selection()).available;
                cartButton.disabled = !available;
                orderButton.disabled = !available;
            };
            offerSelector?.addEventListener("change", updateAvailability);
            updateAvailability();
            cartButton.addEventListener("click", () => addToCart(selection()));
            orderButton.addEventListener("click", () => checkout(orderButton, [orderDetails(selection())]));
        }
        sizeSelect.addEventListener("change", () => updateSize(sizeSelect.value));
        frameSelect.addEventListener("change", () => {
            if (isInterior && product.hoverImage) showArtwork(false);
            updateFrame(frameSelect.value);
        });
        bindFrameSwatches(summary, frameSelect);
        updateSize(initialSizeId);
        updateFrame(defaultFrameId);
        const profileLink = summary.querySelector("[data-author-profile]");
        import("../../build/js/artist-data.js").then(async ({ loadPublicArtistProfile }) => {
            const profile = await loadPublicArtistProfile({ work_id: product.slug.slice("artist-".length) });
            if (!profile?.slug) return;
            profileLink.href = `./?author=${encodeURIComponent(profile.slug)}`;
            profileLink.textContent = "Artist profile";
        }).catch(() => {});
        renderProductRecommendations(product, initialSizeId);
        renderGlobalUi();
    };

    const renderProductPage = () => {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("slug");
        const requestedSizeId = params.get("size");
        const product = getProductBySlug(slug);
        const gallery = document.querySelector("#productGallery");
        const summary = document.querySelector("#productSummary");
        const footerMenu = document.querySelector("#productFooterMenu");

        if (slug?.startsWith("artist-")) {
            if (product.slug === slug) {
                renderArtistProduct(product, gallery, summary, requestedSizeId);
            } else {
                document.title = "Artwork unavailable — Mukashov Gallery";
                summary.innerHTML = '<div class="product-panel"><h1>Artwork unavailable</h1><a class="button button--line" href="./">Catalogue</a></div>';
            }
            return;
        }

        const availableSizeIds = Object.keys(product.priceBySize);
        const initialSizeId = availableSizeIds.includes(requestedSizeId)
            ? requestedSizeId
            : availableSizeIds.includes(defaultSizeId)
                ? defaultSizeId
                : availableSizeIds[0];
        const images = getGalleryImages(product);
        const state = {
            sizeId: initialSizeId,
            frameId: defaultFrameId,
            activeImageIndex: 0
        };
        const thumbCount = Math.max(images.length, 1);

        document.title = `${product.title} — Mukashov Gallery`;
        const renderFeatured = () => renderProductRecommendations(product, state.sizeId);

        if (gallery) {
            gallery.style.setProperty("--gallery-thumb-count", String(thumbCount));
            gallery.innerHTML = `
                <div class="product-gallery">
                    <div class="product-gallery__thumbs">
                        ${images.map((image, index) => `
                            <button class="product-gallery__thumb${index === state.activeImageIndex ? " is-active" : ""}" type="button" data-gallery-thumb="${index}" aria-label="Photo ${index + 1}" aria-pressed="${index === state.activeImageIndex}">
                                <img src="${image}" alt="" aria-hidden="true">
                            </button>
                        `).join("")}
                    </div>
                    <div class="product-preview" id="productPreview">
                        <div class="product-preview__frame">
                            <img src="${images[state.activeImageIndex]}" alt="${escapeHtml(product.title)} — ${escapeHtml(product.artist)}" data-role="product-image">
                        </div>
                    </div>
                </div>
            `;
        }

        if (summary) {
            summary.innerHTML = `
                <div class="product-panel">
                    <div class="product-panel__head">
                        <div>
                            <p class="eyebrow">${product.series || "Canvas Print"}</p>
                            <h1>${escapeHtml(product.title)}</h1>
                            <p class="product-panel__artist">${product.artist}</p>
                        </div>
                        ${buildFavouriteButton(product.slug)}
                    </div>

                    <div class="product-panel__price-row">
                        <span>Total</span>
                        <strong data-role="total-price" aria-live="polite"></strong>
                    </div>


                    ${renderProductOptions((shared.sizes || []).filter((size) => availableSizeIds.includes(size.id)), initialSizeId)}

                    <div class="summary-actions">
                        <button class="button button--solid" type="button" data-role="add-to-cart">Add to Bag</button>
                        <button type="button" class="button button--line" data-role="order-link">Order via WhatsApp</button>
                        ${product.artistProfileSlug ? `<a class="button button--ghost" href="./?author=${encodeURIComponent(product.artistProfileSlug)}">Artist profile</a>` : ""}
                        <a class="button button--ghost" href="./">Catalog</a>
                    </div>

                    <div class="selection-summary">
                        <div class="selection-summary__row">
                            <span>Selected</span>
                            <strong data-role="selection-value"></strong>
                        </div>
                        <div class="selection-summary__row">
                            <span>Production</span>
                            <strong>${product.leadTime}</strong>
                        </div>
                    </div>
                    ${renderProductDetails(product)}
                </div>
            `;
        }

        if (footerMenu) {
            footerMenu.innerHTML = buildInfoMenu(product.slug, null, getInfoSections(product));
        }

        renderFeatured();
        renderGlobalUi();
        bindProductViewportEvents();

        const preview = gallery?.querySelector("#productPreview");
        const previewImage = document.querySelector("[data-role='product-image']");
        const selectionValue = document.querySelector("[data-role='selection-value']");
        const totalPrice = document.querySelector("[data-role='total-price']");
        const orderLink = document.querySelector("[data-role='order-link']");
        const sizeHint = document.querySelector("[data-role='size-hint']");
        const frameHint = document.querySelector("[data-role='frame-hint']");
        const sizeSelect = document.querySelector("[data-role='size-select']");
        const frameSelect = document.querySelector("[data-role='frame-select']");
        const addToCartButton = document.querySelector("[data-role='add-to-cart']");
        const galleryThumbs = Array.from(document.querySelectorAll("[data-gallery-thumb]"));
        const updateFrameHint = (frameId) => {
            const frame = findFrame(frameId) || shared.frames?.[0];

            if (frameHint && frame) {
                frameHint.textContent = `${frame.label} / ${frame.description}`;
            }
        };

        const syncState = () => {
            const size = findSize(state.sizeId) || shared.sizes?.[0];
            const frame = findFrame(state.frameId) || shared.frames?.[0];
            const total = getBasePrice(product, state.sizeId) + (frame?.surcharge || 0);

            galleryThumbs.forEach((button) => {
                const isActive = Number(button.dataset.galleryThumb) === state.activeImageIndex;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });

            if (sizeSelect) {
                sizeSelect.value = state.sizeId;
            }

            if (frameSelect) {
                frameSelect.value = state.frameId;
            }

            applyFramePreview(preview, frame);
            preview?.classList.toggle("is-framed", state.activeImageIndex === 0);
            const nextImage = images[state.activeImageIndex];
            if (previewImage && previewImage.getAttribute("src") !== nextImage) {
                previewImage.src = nextImage;
            }

            if (selectionValue) {
                selectionValue.textContent = `${size.label} / ${frame.label}`;
            }

            if (totalPrice) {
                totalPrice.textContent = formatPrice(total);
            }

            if (sizeHint) {
                sizeHint.textContent = size.note;
            }

            updateFrameHint(state.frameId);

            if (orderLink) {
                orderLink.onclick = () => checkout(orderLink, [orderDetails({ slug: product.slug, sizeId: size.id, frameId: frame.id, quantity: 1 })]);
            }

            renderFeatured();
            renderGlobalUi();
        };

        if (sizeSelect) {
            sizeSelect.addEventListener("change", () => {
                state.sizeId = sizeSelect.value;
                syncState();
            });
        }

        if (frameSelect) {
            frameSelect.addEventListener("change", () => {
                state.frameId = frameSelect.value;
                state.activeImageIndex = 0;
                syncState();
            });
        }

        bindFrameSwatches(summary, frameSelect);
        galleryThumbs.forEach((button) => {
            button.addEventListener("click", () => {
                state.activeImageIndex = Number(button.dataset.galleryThumb) || 0;
                syncState();
            });
        });

        if (addToCartButton) {
            addToCartButton.addEventListener("click", () => {
                addToCart({
                    slug: product.slug,
                    sizeId: state.sizeId,
                    frameId: state.frameId,
                    quantity: 1
                });
            });
        }

        syncState();
        queueProductViewportHeightSync();
        window.setTimeout(queueProductViewportHeightSync, 120);
    };

    const renderInfoPage = () => {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("slug");
        if (slug?.startsWith("artist-")) {
            window.location.replace(buildProductUrl(slug));
            return;
        }
        const sectionParam = params.get("section") || "about";
        const product = getProductBySlug(slug);
        const sections = getInfoSections(product);
        const availableSections = Object.keys(sections);
        const section = sections[sectionParam] ? sectionParam : availableSections[0];
        const current = sections[section];

        const media = document.querySelector("#infoPageMedia");
        const content = document.querySelector("#infoPageContent");
        const footerMenu = document.querySelector("#infoPageMenu");
        const backLink = document.querySelector("#infoBackLink");

        document.title = `${current.title} — ${product.title}`;
        if (backLink) {
            backLink.href = `./product.html?slug=${product.slug}`;
            backLink.textContent = product.title;
        }

        if (media) {
            media.innerHTML = `
                <div class="info-page-media">
                    <img src="${product.hoverImage || product.image}" alt="${escapeHtml(product.title)} — ${escapeHtml(product.artist)}">
                </div>
            `;
        }

        if (content) {
            const body = current.type === "list"
                ? `<ul class="editorial-list">${current.content.map((item) => `<li>${item}</li>`).join("")}</ul>`
                : current.content.map((paragraph) => `<p>${paragraph}</p>`).join("");

            content.innerHTML = `
                <article class="info-page-card">
                    <p class="eyebrow">${current.eyebrow}</p>
                    <h1>${current.title}</h1>
                    <p class="info-page-card__meta">${escapeHtml(product.title)} / ${escapeHtml(product.artist)}</p>
                    <div class="info-page-card__body">
                        ${body}
                    </div>
                    <div class="summary-actions">
                        <a class="button button--solid" href="./product.html?slug=${product.slug}">Back to Print</a>
                    </div>
                </article>
            `;
        }

        if (footerMenu) {
            footerMenu.innerHTML = buildInfoMenu(product.slug, section, sections);
        }

        renderGlobalUi();
    };

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".filter-dropdown")) {
            document.querySelectorAll(".filter-dropdown[open]").forEach((dropdown) => {
                dropdown.open = false;
            });
        }

        const favouriteButton = event.target.closest("[data-favourite-toggle]");
        const favouritesOpenButton = event.target.closest("[data-favourites-open]");
        const cartOpenButton = event.target.closest("[data-cart-open]");
        const drawerCloseButton = event.target.closest("[data-drawer-close]");
        const removeFavouriteButton = event.target.closest("[data-remove-favourite]");
        const removeCartButton = event.target.closest("[data-remove-cart]");
        const cartAdjustButton = event.target.closest("[data-cart-adjust]");

        if (favouriteButton) {
            event.preventDefault();
            toggleFavourite(favouriteButton.dataset.slug);
        }

        if (favouritesOpenButton) {
            event.preventDefault();
            openDrawer("favourites");
        }

        if (cartOpenButton) {
            event.preventDefault();
            openDrawer("cart");
        }

        if (drawerCloseButton || event.target === overlay) {
            closeDrawers();
        }

        if (removeFavouriteButton) {
            favourites = favourites.filter((slug) => slug !== removeFavouriteButton.dataset.slug);
            saveFavourites();
            renderGlobalUi();
        }

        if (removeCartButton) {
            removeCartItem(removeCartButton.dataset.cartKey);
        }

        if (cartAdjustButton) {
            adjustCartItem(
                cartAdjustButton.dataset.cartKey,
                cartAdjustButton.dataset.cartAdjust === "increase" ? 1 : -1
            );
        }
    });

    if (page === "catalog" && !window.location.search) {
        renderCatalogGrid(getInitialCatalogState());
    }

    try {
        const { applyCatalogueAssignment, loadArtistProducts, loadPublicArtistProfile, loadCatalogArtistAssignments } = await import("../../build/js/artist-data.js");
        const timeout = AbortSignal.timeout(8000);
        const [artworks, profile, assignments] = await Promise.race([
            Promise.all([
                loadArtistProducts(),
                profileHandle ? loadPublicArtistProfile({ profile_handle: profileHandle }) : null,
                loadCatalogArtistAssignments().catch(() => [])
            ]),
            new Promise((_, reject) => timeout.addEventListener("abort", () => reject(timeout.reason), { once: true }))
        ]);
        const owners = new Map(assignments.map((assignment) => [assignment.product_slug, assignment]));
        catalog = [...artworks, ...catalog.map((work) => applyCatalogueAssignment(work, owners.get(work.slug)))];
        publicArtist = profile;
        if (profileHandle && !publicArtist) {
            const status = document.querySelector("#catalog-status");
            status.hidden = false;
            status.textContent = "Artist profile not found.";
            renderGlobalUi();
            return;
        }
        if (publicArtist) {
            document.title = `${publicArtist.name} — Mukashov Gallery`;
            document.querySelector("#public-artist-name").textContent = publicArtist.name;
            document.querySelector("#public-artist-city").textContent = publicArtist.city;
            document.querySelector("#public-artist-heading").hidden = false;
        }
    } catch (error) {
        const status = document.querySelector("#catalog-status");
        if (status) {
            status.hidden = false;
            status.textContent = profileHandle
                ? "Could not open the artist profile. Try refreshing the page."
                : "Artist artworks are temporarily unavailable. Try refreshing the page.";
        }
        console.warn("Prints: gallery unavailable", error.code || error.name);
    }

    renderGlobalUi();

    if (page === "catalog" && (!profileHandle || publicArtist)) {
        renderCatalogPage();
    }

    if (page === "product") {
        renderProductPage();
    }

    if (page === "info") {
        renderInfoPage();
    }
});

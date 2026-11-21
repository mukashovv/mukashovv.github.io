(() => {
    // Image load events do not bubble. Capture them for newly rendered cards and previews.
    document.addEventListener("load", async (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;
        const layer = image.parentElement;
        if (!layer?.matches(".artwork-scene__mount, .artwork-scene--photo")) return;
        try {
            await image.decode?.();
        } catch {
            if (!image.naturalWidth) return;
        }
        layer.classList.add("is-ready");
    }, true);

    const revealed = new Set();
    let observer;

    function reveal(media) {
        const image = media.querySelector("img");
        if (image.complete) return;
        const delay = setTimeout(() => {
            if (media.isConnected && !image.complete) media.classList.add("is-loading");
        }, 350);
        const finish = () => {
            clearTimeout(delay);
            if (!media.isConnected) return;
            if (image.naturalWidth) {
                revealed.add(image.src);
                if (media.classList.contains("is-loading")) media.classList.add("is-revealed");
            } else {
                media.classList.remove("is-loading");
            }
        };
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
    }

    window.prepareGalleryCards = (grid) => {
        observer?.disconnect();
        if (!("IntersectionObserver" in window)) return;
        observer ||= new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.unobserve(entry.target);
                reveal(entry.target);
            }
        });
        for (const media of grid.querySelectorAll(".print-card__media")) {
            const image = media.querySelector("img");
            if (!image || revealed.has(image.src)) continue;
            observer.observe(media);
        }
    };
})();

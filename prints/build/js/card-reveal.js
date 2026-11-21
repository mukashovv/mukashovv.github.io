(() => {
    const revealed = new Set();
    let observer;

    function reveal(media) {
        const image = media.querySelector("img");
        const finish = () => {
            if (!media.isConnected) return;
            if (image.naturalWidth) {
                revealed.add(image.src);
                media.classList.add("is-revealed");
            } else {
                media.classList.remove("is-loading");
            }
        };
        const loaded = () => {
            if (image.decode) image.decode().then(finish, finish);
            else finish();
        };
        if (image.complete) loaded();
        else {
            image.addEventListener("load", loaded, { once: true });
            image.addEventListener("error", finish, { once: true });
        }
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
            media.classList.add("is-loading");
            observer.observe(media);
        }
    };
})();

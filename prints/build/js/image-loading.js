(() => {
    const pending = new WeakMap();
    async function updateImage(image) {
        if (!image.matches?.("img[data-gallery-image]") || !image.complete) return;
        const source = image.currentSrc || image.src;
        if (pending.get(image) === source || image.dataset.galleryState === "ready") return;
        if (!image.naturalWidth) {
            image.dataset.galleryState = "error";
            return;
        }
        pending.set(image, source);
        try {
            await image.decode();
        } catch {
            // The browser can still display a loaded image when decode is interrupted.
        } finally {
            if (pending.get(image) === source) pending.delete(image);
        }
        if ((image.currentSrc || image.src) === source && image.complete) {
            image.dataset.galleryState = image.naturalWidth ? "ready" : "error";
        }
    }

    document.addEventListener("load", (event) => updateImage(event.target), true);
    document.addEventListener("error", (event) => updateImage(event.target), true);

    window.galleryImagesReady = () => {
        const region = document.querySelector('[aria-busy="true"]:is(#printsGrid, #productGallery, #infoPageMedia)');
        if (region) {
            region.querySelectorAll(".gallery-placeholder").forEach((placeholder) => placeholder.remove());
            region.removeAttribute("aria-label");
            region.removeAttribute("aria-busy");
        }
        document.querySelectorAll("img[data-gallery-image]").forEach(updateImage);
    };
})();

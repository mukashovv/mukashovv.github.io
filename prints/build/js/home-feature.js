import { projectUrl } from "./supabase-config.js";

export const layouts = {
    classic: { label: "Два интерьера", ru: ["Горы Кыргызстана", "Два пейзажа Жаныбека Мукаша в интерьере.", "Смотреть каталог"],
        en: ["The mountains of Kyrgyzstan", "Two landscapes by Janybek Mukash, seen at home.", "Browse the catalogue"] },
    panorama: { label: "Панорама", ru: ["Последние лучи в Ала-Арче", "Горный пейзаж Жаныбека Мукаша.", "Выбрать работу"],
        en: ["Last light in Ala-Archa", "A mountain landscape by Janybek Mukash.", "Explore the gallery"] },
    edition: { label: "Альбом", ru: ["Два взгляда на горы", "Ала-Арча и Терскей-Ала-Тоо в фотографиях Жаныбека Мукаша.", "К коллекции"],
        en: ["Two views of the mountains", "Ala-Archa and Teskey Ala-Too through the lens of Janybek Mukash.", "View the collection"] }
};

export function renderFeature(section, layout, copy, lang, previews = []) {
    const defaults = layouts[layout]?.[lang];
    if (!defaults) return;
    section.dataset.layout = layout;
    const fields = ["h1", ".gallery-feature__copy p", ".gallery-feature__actions .button"];
    fields.forEach((selector, i) => {
        section.querySelector(selector).textContent = copy?.[lang]?.[i] || defaults[i];
    });
    const images = section.querySelectorAll(".gallery-feature__work img");
    const interiors = ["last-sunlight-in-ala-archa-in-action", "hidden-heart-of-teskey-ala-too-interior"];
    const originals = ["last-sunlight-in-ala-archa", "hidden-heart-of-teskey-ala-too"];
    images.forEach((image, i) => {
        const file = layout === "classic" ? interiors[i] : originals[i];
        const path = copy?.photos?.[i];
        const custom = previews[i] || (typeof path === "string" && /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path)
            ? projectUrl + "/storage/v1/object/public/prints-home-photos/" + path : null);
        if (custom) {
            image.src = custom;
            const link = image.closest("a");
            link.removeAttribute("href");
            link.removeAttribute("aria-label");
            link.querySelector("span").hidden = true;
            return;
        }
        image.src = "/prints/build/img/" + file + ".webp";
    });
}

import { orderPhone } from "./artist-data.js";

const galleryPhone = "996709139603";

export async function checkout(button, items) {
    if (!items.length || button.disabled) return;
    button.disabled = true;
    const en = document.documentElement.lang === "en";
    try {
        const singleWork = new Set(items.map(({ product }) => product.slug)).size === 1;
        const recipient = singleWork ? await orderPhone(items[0].product) : null;
        const phone = (recipient || galleryPhone).replace(/^\+/, "");
        if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error("Invalid phone");
        const lines = items.map(({ product, size, frame, offerLabel, quantity, totalPrice }) => [
            product.title + " — " + product.artist,
            [offerLabel, size.label, frame.label].filter(Boolean).join(" / "),
            quantity + " × " + (totalPrice / quantity) + " сом",
            "https://mukashov.com/prints/product.html?slug=" + encodeURIComponent(product.slug)
        ].join("\n"));
        const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
        const message = [en ? "Hello! I'd like to order" : "Здравствуйте! Хочу заказать", ...lines,
            (en ? "Total" : "Итого") + " — " + total + " сом"].join("\n\n");
        window.location.assign("https://wa.me/" + phone + "?text=" + encodeURIComponent(message));
    } catch {
        window.alert(en ? "Could not get the artist’s WhatsApp. Please try again." :
            "Не удалось получить WhatsApp автора. Попробуйте ещё раз.");
    } finally {
        button.disabled = false;
    }
}

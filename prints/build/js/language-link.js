const languageLink = document.querySelector("[data-gallery-language]");
if (languageLink) {
    const updateLanguageLink = () => {
        const target = new URL(languageLink.href);
        target.search = window.location.search;
        languageLink.href = target.href;
    };
    updateLanguageLink();
    languageLink.addEventListener("pointerdown", updateLanguageLink);
    languageLink.addEventListener("focus", updateLanguageLink);
    languageLink.addEventListener("click", updateLanguageLink);
}

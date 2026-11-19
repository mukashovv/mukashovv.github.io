import { createPrintsClient } from "./artist-data.js";

for (const menu of document.querySelectorAll("[data-profile-menu]")) {
    const guest = menu.querySelector("[data-profile-guest]");
    const account = menu.querySelector("[data-profile-account]");
    const signOut = menu.querySelector("[data-profile-signout]");
    const notice = menu.querySelector(".profile-menu__notice");
    let client;
    let connecting = false;

    async function connect() {
        if (client || connecting) return;
        connecting = true;
        guest.hidden = true;
        notice.hidden = false;
        notice.textContent = "Проверяем вход…";
        try {
            client = await createPrintsClient({ account: true });
            client.auth.onAuthStateChange((_event, session) => {
                guest.hidden = Boolean(session);
                account.hidden = !session;
                notice.hidden = true;
            });
        } catch {
            guest.hidden = false;
            notice.hidden = true;
        } finally {
            connecting = false;
        }
    }

    menu.addEventListener("toggle", () => {
        if (menu.open) connect();
    });
    document.addEventListener("click", (event) => {
        if (!menu.contains(event.target)) menu.open = false;
    });
    menu.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menu.open) {
            menu.open = false;
            menu.querySelector("summary").focus();
        }
    });
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
        menu.open = false;
    }));
    signOut.addEventListener("click", async () => {
        signOut.disabled = true;
        try {
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error) throw error;
            menu.open = false;
            menu.querySelector("summary").focus();
        } catch {
            notice.textContent = "Не удалось выйти. Попробуйте ещё раз.";
            notice.hidden = false;
        } finally {
            signOut.disabled = false;
        }
    });
}

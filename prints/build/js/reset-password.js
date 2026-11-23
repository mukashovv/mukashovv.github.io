import { projectUrl, publishableKey } from "./supabase-config.js";

const form = document.querySelector("#reset-form");
const status = document.querySelector("#reset-status");
const fragment = new URLSearchParams(location.hash.slice(1));
history.replaceState(null, "", location.pathname);
try {
    if (fragment.get("type") !== "recovery" || !fragment.get("access_token") || !fragment.get("refresh_token")) {
        throw new Error("Missing recovery session");
    }
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const client = createClient(projectUrl, publishableKey, {
        auth: { storageKey: "prints-password-reset", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data, error } = await client.auth.setSession({
        access_token: fragment.get("access_token"), refresh_token: fragment.get("refresh_token")
    });
    if (error || !data.user) throw new Error("Expired link");
    form.hidden = false;
    status.textContent = "Введите новый пароль для " + data.user.email + " (от 10 символов).";
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button");
        if (button.disabled) return;
        button.disabled = true;
        try {
            const { error } = await client.auth.updateUser({ password: form.elements.password.value });
            if (error) throw error;
            form.reset();
            form.hidden = true;
            status.textContent = "Пароль сохранён. Теперь можно войти с новым паролем.";
            await client.auth.signOut({ scope: "local" }).catch(() => {});
        } catch {
            status.textContent = "Не удалось сохранить пароль. Попробуйте другой пароль или запросите свежую ссылку.";
        } finally {
            button.disabled = false;
        }
    });
} catch {
    status.textContent = "Ссылка недействительна или устарела. Перейдите ко входу и нажмите «Забыли пароль?».";
}

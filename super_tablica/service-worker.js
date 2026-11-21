const home = new URL(self.registration.scope);
const entry = new URL("index.html", home);
const offlinePage = `<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Супер Таблица</title>
<style>body{font:1rem/1.6 system-ui;margin:10vh auto;padding:1.5rem;max-width:30rem;color:#282b28}a{color:inherit}</style>
<h1>Нет соединения</h1><p>Для открытия таблицы нужен интернет.</p><a href="./">Попробовать снова</a></html>`;

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== home.origin || (url.pathname !== home.pathname && url.pathname !== entry.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => new Response(offlinePage, {
    status: 503,
    headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}
  })));
});

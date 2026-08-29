/* Service worker do Zap Entregas — recebe Web Push com o app fechado. */

// Mude a versão sempre que mexer neste arquivo: é o que faz o celular baixar o
// service worker novo em vez de continuar com o antigo em cache.
const SW_VERSION = "2026-08-29-badge";

// icon  = imagem grande, colorida, que aparece dentro do aviso.
// badge = iconezinho da barra de status. O Android usa SÓ o recorte (o alfa) e
//         pinta de branco — por isso tem que ser a silhueta monocromática. Com um
//         ícone colorido/quadrado ali, ele vira aquele quadrado branco.
const ICON = "/icon-192.png";
const BADGE = "/badge-96.png";

self.addEventListener("install", () => {
    console.log("[SW] instalando versão", SW_VERSION);
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = { title: "Zap Entregas", body: "", url: "/app", tag: undefined };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch {
        if (event.data) data.body = event.data.text();
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            tag: data.tag,
            renotify: !!data.tag,
            icon: data.icon || ICON,
            badge: data.badge || BADGE,
            vibrate: [200, 100, 200],
            data: { url: data.url || "/app" },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/app";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});

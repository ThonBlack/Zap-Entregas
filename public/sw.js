/* Service worker do Zap Entregas — recebe Web Push e faz o app abrir sem rede. */

// Mude a versão sempre que mexer neste arquivo: é o que faz o celular baixar o
// service worker novo em vez de continuar com o antigo em cache.
const SW_VERSION = "2026-09-07-offline";

// Dois depósitos separados: o dos arquivos que nunca mudam de conteúdo (JS/CSS
// com hash no nome, ícones) e o das páginas, que a gente guarda só como
// último recurso pra quando a internet cair.
const CACHE_ESTATICO = `zap-estatico-${SW_VERSION}`;
const CACHE_PAGINAS = `zap-paginas-${SW_VERSION}`;
const PAGINA_OFFLINE = "/offline.html";

// icon  = imagem grande, colorida, que aparece dentro do aviso.
// badge = iconezinho da barra de status. O Android usa SÓ o recorte (o alfa) e
//         pinta de branco — por isso tem que ser a silhueta monocromática. Com um
//         ícone colorido/quadrado ali, ele vira aquele quadrado branco.
const ICON = "/icon-192.png";
const BADGE = "/badge-96.png";

self.addEventListener("install", (event) => {
    console.log("[SW] instalando versão", SW_VERSION);
    // Guarda a página de "sem internet" já na instalação: se ela só fosse
    // buscada na hora do erro, não estaria lá justamente quando faz falta.
    event.waitUntil(
        caches.open(CACHE_ESTATICO)
            .then((c) => c.addAll([PAGINA_OFFLINE, ICON, BADGE]))
            .catch((e) => console.warn("[SW] não deu pra guardar o básico:", e))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Faxina: depósito de versão antiga só ocupa espaço no celular.
    event.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(
                nomes
                    .filter((n) => n.startsWith("zap-") && n !== CACHE_ESTATICO && n !== CACHE_PAGINAS)
                    .map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

/**
 * Nunca guardar em cache: nada disso pode ser respondido com resposta velha.
 *  - /api/*        : dados que mudam a cada segundo (saldo, corridas, avisos)
 *  - /confirmar/*  : token de uso único do PDV
 *  - /tracking/*   : o cliente precisa ver a posição de AGORA
 *  - /review/*     : idem, uso único
 */
function ehRotaProibida(url) {
    return (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/confirmar/") ||
        url.pathname.startsWith("/tracking/") ||
        url.pathname.startsWith("/review/")
    );
}

/** Arquivo com hash no nome (ou ícone): o conteúdo nunca muda pra aquele endereço. */
function ehArquivoFixo(url) {
    return (
        url.pathname.startsWith("/_next/static/") ||
        /\.(png|jpg|jpeg|svg|webp|ico|woff2?|wav)$/i.test(url.pathname) ||
        url.pathname === "/manifest.json"
    );
}

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Só GET. POST é server action / formulário — responder do cache seria
    // fingir que a corrida foi salva sem ter sido.
    if (req.method !== "GET") return;

    const url = new URL(req.url);

    // Outro domínio (Google Maps, tiles do OSM): deixa passar direto.
    if (url.origin !== self.location.origin) return;

    if (ehRotaProibida(url)) return;

    // Arquivo fixo: cache primeiro, que é instantâneo e não gasta dado.
    if (ehArquivoFixo(url)) {
        event.respondWith(
            caches.match(req).then((guardado) => {
                if (guardado) return guardado;
                return fetch(req).then((resp) => {
                    if (resp && resp.ok) {
                        const copia = resp.clone();
                        caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
                    }
                    return resp;
                });
            })
        );
        return;
    }

    // Página (navegação): rede primeiro — o app é de tempo real, o certo é
    // sempre o que o servidor disser. O cache é só a rede de segurança.
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    if (resp && resp.ok) {
                        const copia = resp.clone();
                        caches.open(CACHE_PAGINAS).then((c) => c.put(req, copia));
                    }
                    return resp;
                })
                .catch(async () => {
                    const guardado = await caches.match(req);
                    if (guardado) return guardado;
                    const offline = await caches.match(PAGINA_OFFLINE);
                    if (offline) return offline;
                    return new Response("Sem internet.", {
                        status: 503,
                        headers: { "Content-Type": "text/plain; charset=utf-8" },
                    });
                })
        );
    }
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

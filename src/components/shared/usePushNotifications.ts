"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Avisos de corrida neste aparelho.
 *
 * Junta as três coisas que precisam andar juntas: o estado da permissão do
 * navegador, a inscrição no Web Push (o que faz o aviso chegar COM O APP
 * FECHADO) e a checagem periódica enquanto a aba está aberta.
 *
 * Só roda no navegador — quem usa precisa ser carregado com ssr: false.
 */

/** "sem-suporte" = navegador que não sabe notificar (não adianta pedir nada). */
export type EstadoPermissao = NotificationPermission | "sem-suporte";

const CHAVE_ADIADO = "zap_convite_avisos_adiado_ate";
const UM_DIA = 24 * 60 * 60 * 1000;
const INTERVALO_CHECAGEM = 10000;

function permissaoAtual(): EstadoPermissao {
    if (typeof window === "undefined" || !("Notification" in window)) return "sem-suporte";
    return Notification.permission;
}

function adiadoAinda(): boolean {
    try {
        const ate = Number(localStorage.getItem(CHAVE_ADIADO) || 0);
        return Number.isFinite(ate) && ate > Date.now();
    } catch {
        return false;
    }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePushNotifications(userId: number) {
    const [permissao, setPermissao] = useState<EstadoPermissao>(permissaoAtual);
    const [adiado, setAdiado] = useState(adiadoAinda);
    const [pedindo, setPedindo] = useState(false);
    const [erroInscricao, setErroInscricao] = useState("");
    // Começa AGORA, não em 1970. Com 0, a primeira checagem pedia "tudo desde o
    // começo dos tempos" e o celular tocava 7 vezes seguidas com as corridas que
    // o motoboy já estava olhando na tela.
    const ultimaChecagem = useRef(Date.now());
    const audio = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audio.current = new Audio("/notification.wav");
        audio.current.volume = 0.5;
    }, []);

    const mostrarNotificacao = useCallback((titulo: string, corpo: string, icone?: string, marca?: string) => {
        if (permissaoAtual() !== "granted") return;

        audio.current?.play().catch(() => { });
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);

        const n = new Notification(titulo, {
            body: corpo,
            icon: icone || "/icon-192.png",
            // badge = iconezinho da barra de status: o Android usa só o recorte e pinta
            // de branco, então precisa ser a silhueta monocromática (senão vira quadrado).
            badge: "/badge-96.png",
            // Marca fixa por corrida: dois avisos da MESMA corrida se substituem em
            // vez de empilhar. Com `zap-${Date.now()}` cada checagem virava um aviso
            // novo. E sem requireInteraction o aviso some sozinho — antes ficava
            // grudado na tela até o motoboy dispensar um por um.
            tag: marca || "zap-aviso",
        });
        n.onclick = () => { window.focus(); n.close(); };
    }, []);

    // Inscrição no Web Push. Refeita a cada abertura de propósito: o endereço
    // do navegador expira sozinho de vez em quando e precisa ser regravado.
    useEffect(() => {
        if (permissao !== "granted") return;
        (async () => {
            try {
                if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                    setErroInscricao("Este navegador não guarda avisos com o app fechado. Instale o app na tela inicial.");
                    return;
                }
                const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidKey) {
                    setErroInscricao("O servidor está sem a chave dos avisos. Avise o administrador.");
                    return;
                }
                const reg = await navigator.serviceWorker.register("/sw.js");
                await navigator.serviceWorker.ready;
                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
                    });
                }
                const json = sub.toJSON();
                if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
                    setErroInscricao("O navegador devolveu uma inscrição incompleta. Feche e abra o app de novo.");
                    return;
                }
                const m = await import("@/app/actions/push");
                const res = await m.savePushSubscriptionAction(
                    { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
                    navigator.userAgent
                );
                if (res && "error" in res) {
                    setErroInscricao(`Não consegui guardar este aparelho: ${res.error}`);
                    return;
                }
                setErroInscricao("");
            } catch (e: unknown) {
                console.error("Falha ao inscrever no push:", e);
                const detalhe = e instanceof Error ? e.message : String(e);
                setErroInscricao(`Não consegui ligar os avisos neste aparelho: ${detalhe}`);
            }
        })();
    }, [permissao]);

    // Fallback de aba aberta: pergunta ao servidor se apareceu corrida nova.
    useEffect(() => {
        if (permissao !== "granted") return;

        const checar = async () => {
            try {
                const r = await fetch(`/api/notifications/check?userId=${userId}&lastCheck=${ultimaChecagem.current}`);
                const data = await r.json();
                for (const n of data.notifications ?? []) mostrarNotificacao(n.title, n.body, n.icon, n.tag);
                ultimaChecagem.current = Date.now();
            } catch (e) {
                console.error("Erro ao checar notificações:", e);
            }
        };

        const intervalo = setInterval(checar, INTERVALO_CHECAGEM);
        return () => clearInterval(intervalo);
    }, [permissao, userId, mostrarNotificacao]);

    /** Abre a caixa do próprio navegador pedindo a permissão. */
    const pedirPermissao = useCallback(async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        setPedindo(true);
        try {
            setPermissao(await Notification.requestPermission());
        } finally {
            setPedindo(false);
        }
    }, []);

    /** "Depois": o convite some por 24 horas neste aparelho. */
    const adiarPorUmDia = useCallback(() => {
        try {
            localStorage.setItem(CHAVE_ADIADO, String(Date.now() + UM_DIA));
        } catch {
            /* sem localStorage: some só nesta visita */
        }
        setAdiado(true);
    }, []);

    return {
        permissao,
        /** Deve aparecer o convite grande? */
        convidando: permissao === "default" && !adiado,
        pedindo,
        erroInscricao,
        limparErro: useCallback(() => setErroInscricao(""), []),
        pedirPermissao,
        adiarPorUmDia,
    };
}

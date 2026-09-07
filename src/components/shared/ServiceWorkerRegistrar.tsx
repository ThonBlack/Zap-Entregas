"use client";

import { useEffect } from "react";

/**
 * Liga o service worker em toda página.
 *
 * Antes ele só era registrado dentro do fluxo de permissão de aviso, e só na
 * tela /app: quem tocava em "Depois" ficava sem service worker nenhum. Sem ele
 * o app não abre offline e o Chrome nem oferece "instalar na tela inicial".
 *
 * Registrar é barato e silencioso — não pede permissão nenhuma ao usuário.
 */
export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        // Espera a página terminar de carregar pra não disputar banda com ela.
        const registrar = () => {
            navigator.serviceWorker.register("/sw.js").catch((e) => {
                console.warn("[sw] não deu pra registrar:", e);
            });
        };
        if (document.readyState === "complete") registrar();
        else {
            window.addEventListener("load", registrar, { once: true });
            return () => window.removeEventListener("load", registrar);
        }
    }, []);

    return null;
}

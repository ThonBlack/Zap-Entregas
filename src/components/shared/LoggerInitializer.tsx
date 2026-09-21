"use client";

import { useEffect } from "react";
import { AppLogger } from "@/lib/logger";

/**
 * Telas em que NINGUÉM está logado: a autorização é o código da URL.
 *
 * O logger manda tudo pro `POST /api/logs`, que exige sessão e devolve 401. Numa
 * dessas páginas isso vira só ruído: um 401 por visita no log do nginx, um erro
 * vermelho no console do navegador do vendedor — e nenhum registro gravado, já
 * que a rota recusa antes de escrever.
 *
 * Pior ainda na Fila da loja, que fica embutida no painel do EpicStore e aberta
 * o expediente todo: seriam 401 a cada troca de tela dentro de um quadro que o
 * lojista nem sabe que é nosso.
 */
const TELAS_SEM_LOGIN = ["/fila/", "/confirmar/", "/tracking/", "/review/"];

// Componente para inicializar o logger globalmente
// Adicionar no RootLayout como: <LoggerInitializer />
export default function LoggerInitializer() {
    useEffect(() => {
        if (TELAS_SEM_LOGIN.some((prefixo) => window.location.pathname.startsWith(prefixo))) {
            return;
        }
        // Configurar handlers globais de erro
        AppLogger.setupGlobalErrorHandlers();

        // Log de sessão iniciada
        AppLogger.info("session_start", "Sessão iniciada", {
            screen: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            referrer: document.referrer || "direct"
        });

        // Log quando usuário sai da página
        const handleUnload = () => {
            AppLogger.info("session_end", "Sessão encerrada");
        };

        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, []);

    return null; // Não renderiza nada
}

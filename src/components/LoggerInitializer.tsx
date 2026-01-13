"use client";

import { useEffect } from "react";
import { AppLogger } from "@/lib/logger";

// Componente para inicializar o logger globalmente
// Adicionar no RootLayout como: <LoggerInitializer />
export default function LoggerInitializer() {
    useEffect(() => {
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

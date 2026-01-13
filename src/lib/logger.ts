// Logger para capturar e enviar eventos/erros para o servidor
// Importar como: import { AppLogger } from "@/lib/logger"

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogData {
    event: string;
    message?: string;
    page?: string;
    metadata?: Record<string, any>;
    stack?: string;
}

class Logger {
    private endpoint = "/api/logs";
    private queue: Array<{ level: LogLevel; data: LogData }> = [];
    private isProcessing = false;

    // Log genérico
    private async log(level: LogLevel, data: LogData) {
        // Adicionar página automaticamente se não informada
        if (typeof window !== "undefined" && !data.page) {
            data.page = window.location.pathname;
        }

        // Adicionar à fila e processar
        this.queue.push({ level, data });
        this.processQueue();
    }

    // Processar fila de logs (evita muitas requisições simultâneas)
    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) continue;

            try {
                await fetch(this.endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        level: item.level,
                        ...item.data
                    })
                });
            } catch (e) {
                // Se falhar, não requeue para evitar loop infinito
                console.error("[Logger] Falha ao enviar log:", e);
            }
        }

        this.isProcessing = false;
    }

    // Métodos públicos
    info(event: string, message?: string, metadata?: Record<string, any>) {
        this.log("info", { event, message, metadata });
    }

    warn(event: string, message?: string, metadata?: Record<string, any>) {
        this.log("warn", { event, message, metadata });
    }

    error(event: string, error: Error | string, metadata?: Record<string, any>) {
        const isErrorObj = error instanceof Error;
        this.log("error", {
            event,
            message: isErrorObj ? error.message : String(error),
            stack: isErrorObj ? error.stack : undefined,
            metadata
        });
    }

    debug(event: string, message?: string, metadata?: Record<string, any>) {
        // Só envia em desenvolvimento
        if (process.env.NODE_ENV === "development") {
            this.log("debug", { event, message, metadata });
        }
    }

    // Capturar erros globais do window
    setupGlobalErrorHandlers() {
        if (typeof window === "undefined") return;

        // Erros não capturados
        window.onerror = (message, source, lineno, colno, error) => {
            this.error("unhandled_error", error || String(message), {
                source,
                lineno,
                colno
            });
        };

        // Promise rejections não tratadas
        window.onunhandledrejection = (event) => {
            this.error("unhandled_rejection", String(event.reason), {
                type: "promise_rejection"
            });
        };
    }
}

// Exportar instância única
export const AppLogger = new Logger();

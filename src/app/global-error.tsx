"use client";

/**
 * Última rede de segurança: erro no PRÓPRIO layout raiz. Aqui o Next descarta o
 * layout inteiro, então esta página precisa desenhar o `<html>` e o `<body>`
 * dela — e não dá pra contar com o Tailwind (o CSS é importado pelo layout que
 * acabou de quebrar). Por isso o estilo vai escrito na mão.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="pt-BR">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#18181b",
                    color: "#ffffff",
                    fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif",
                    padding: "24px",
                }}
            >
                <div style={{ maxWidth: "22rem", textAlign: "center" }}>
                    <div style={{ fontSize: "48px" }} aria-hidden="true">⚠️</div>
                    <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "12px 0" }}>
                        O aplicativo travou
                    </h1>
                    <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: 1.6, margin: "0 0 20px" }}>
                        Alguma coisa deu muito errado ao abrir o Zap Entregas. Tente de novo;
                        se continuar assim, feche e abra o app.
                    </p>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            minHeight: "44px",
                            padding: "0 24px",
                            borderRadius: "12px",
                            border: "none",
                            background: "#16a34a",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "15px",
                            cursor: "pointer",
                            width: "100%",
                        }}
                    >
                        Tentar de novo
                    </button>
                    <a
                        href="/app"
                        style={{
                            display: "block",
                            marginTop: "8px",
                            minHeight: "44px",
                            lineHeight: "44px",
                            borderRadius: "12px",
                            border: "1px solid #52525b",
                            color: "#d4d4d8",
                            fontWeight: 500,
                            fontSize: "15px",
                            textDecoration: "none",
                        }}
                    >
                        Voltar pro início
                    </a>
                    {error.digest && (
                        <p style={{ color: "#52525b", fontSize: "11px", marginTop: "16px", fontFamily: "monospace" }}>
                            código: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}

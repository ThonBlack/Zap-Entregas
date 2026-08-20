"use client";

import { useState } from "react";

interface GoogleButtonProps {
    /** "link" = conectar a conta estando logado (Configurações). */
    mode?: "login" | "link";
    label?: string;
    className?: string;
}

/** Logo oficial do Google — precisa ser o desenho colorido, não um ícone genérico. */
function GoogleLogo() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-3.9 6.8-9.8 6.8-17.1z" />
            <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
    );
}

export default function GoogleButton({ mode = "login", label, className = "" }: GoogleButtonProps) {
    const [indo, setIndo] = useState(false);
    const href = mode === "link" ? "/api/auth/google?link=1" : "/api/auth/google";

    return (
        <a
            href={href}
            onClick={() => setIndo(true)}
            className={`w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-600 bg-white py-3.5 font-semibold text-zinc-800 hover:bg-zinc-100 active:scale-[0.98] transition-all ${indo ? "opacity-60 pointer-events-none" : ""} ${className}`}
        >
            <GoogleLogo />
            {indo ? "Abrindo o Google…" : (label ?? "Entrar com Google")}
        </a>
    );
}

"use client";

import { useState } from "react";

interface AvatarProps {
    src: string | null | undefined;
    name: string;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

// Tamanhos predefinidos
const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-14 h-14 text-xl",
    xl: "w-16 h-16 text-2xl"
};

export default function Avatar({ src, name, size = "lg", className = "" }: AvatarProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const initials = name
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const sizeClass = sizes[size];

    // Se não tem URL ou deu erro, mostra iniciais
    if (!src || hasError) {
        return (
            <div className={`${sizeClass} rounded-full bg-green-500 flex items-center justify-center text-white font-bold shadow-md border-2 border-white/20 ${className}`}>
                {initials}
            </div>
        );
    }

    return (
        <div className={`relative ${sizeClass} ${className}`}>
            {/* Placeholder enquanto carrega */}
            {isLoading && (
                <div className={`absolute inset-0 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold border-2 border-white/20 animate-pulse`}>
                    {initials}
                </div>
            )}

            {/* Imagem real */}
            <img
                src={src}
                alt={name}
                className={`${sizeClass} rounded-full object-cover border-2 border-white/40 shadow-md ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    console.error(`[Avatar] Failed to load: ${src}`);
                    setHasError(true);
                    setIsLoading(false);
                }}
                loading="eager"
                crossOrigin="anonymous"
            />
        </div>
    );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega os dados da página de tempos em tempos, sem piscar a tela toda
 * (router.refresh() só refaz o render do servidor).
 *
 * Usado no rastreio público: sem isso a página é montada uma vez e congela — o
 * cliente ficava olhando "Aguardando motoboy" mesmo depois de o motoboy sair.
 *
 * Para de contar quando a aba está escondida: celular no bolso não precisa
 * gastar bateria e dado atualizando uma tela que ninguém está vendo.
 */
export default function AutoRefresh({ segundos = 20 }: { segundos?: number }) {
    const router = useRouter();

    useEffect(() => {
        const intervalo = Math.max(5, segundos) * 1000;
        let timer: ReturnType<typeof setInterval> | null = null;

        const parar = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };
        const comecar = () => {
            if (timer) return;
            timer = setInterval(() => router.refresh(), intervalo);
        };

        const aoTrocarVisibilidade = () => {
            if (document.hidden) parar();
            else {
                router.refresh(); // voltou pra tela: mostra o estado de agora
                comecar();
            }
        };

        if (!document.hidden) comecar();
        document.addEventListener("visibilitychange", aoTrocarVisibilidade);

        return () => {
            parar();
            document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
        };
    }, [router, segundos]);

    return null;
}

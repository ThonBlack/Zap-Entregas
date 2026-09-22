"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AppDeNavegacao } from "@/lib/mapsLink";
import { lerNavegadorPreferido, gravarNavegadorPreferido } from "@/lib/navegadorPreferido";

/** Quem quer ser avisado quando a escolha muda (as duas telas, ao mesmo tempo). */
const ouvintes = new Set<() => void>();

function avisarTodos() {
    for (const ouvinte of ouvintes) ouvinte();
}

function assinar(aoMudar: () => void) {
    ouvintes.add(aoMudar);
    // "storage" é quando a troca veio de OUTRA aba do mesmo celular.
    window.addEventListener("storage", aoMudar);
    return () => {
        ouvintes.delete(aoMudar);
        window.removeEventListener("storage", aoMudar);
    };
}

/**
 * No servidor não existe localStorage, então o primeiro desenho é sempre
 * "ainda não escolheu". O React troca pelo valor de verdade logo depois da
 * hidratação — sem aquele erro de "o HTML do servidor não bate com o do
 * navegador" que daria se a gente chutasse aqui.
 */
const NO_SERVIDOR = () => null;

/**
 * Com qual aplicativo o motoboy navega — do jeito que a tela precisa.
 *
 * `null` = ainda não escolheu (e aí o botão Navegar pergunta). Mora aqui, e não
 * no `src/lib`, porque é a única parte disso que depende do React: a
 * leitura/gravação crua fica em `@/lib/navegadorPreferido`.
 */
export function useNavegadorPreferido() {
    const navegador = useSyncExternalStore<AppDeNavegacao | null>(
        assinar, lerNavegadorPreferido, NO_SERVIDOR,
    );

    /** Grava (ou apaga, com `null`) e atualiza todas as telas abertas. */
    const escolher = useCallback((app: AppDeNavegacao | null) => {
        gravarNavegadorPreferido(app);
        avisarTodos();
    }, []);

    return { navegador, escolher };
}

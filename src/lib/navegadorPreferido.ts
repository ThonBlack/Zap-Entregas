/**
 * Com qual aplicativo o motoboy quer navegar — Google Maps ou Waze.
 *
 * Fica no APARELHO (localStorage), não no banco: é preferência de quem está
 * segurando o celular, e o João troca de aparelho/entra na conta da loja sem que
 * isso precise virar coluna em `users`.
 *
 * Sem preferência gravada = perguntar na hora do clique.
 *
 * Todo acesso vai dentro de try/catch: em aba anônima, com dados do site
 * bloqueados ou no meio de uma renderização no servidor, o localStorage
 * simplesmente explode — e um erro aqui não pode derrubar o botão "Navegar".
 */

import type { AppDeNavegacao } from "@/lib/mapsLink";

const CHAVE = "zap_navegador_preferido";

/** O que o motoboy escolheu, ou `null` quando é pra perguntar toda vez. */
export function lerNavegadorPreferido(): AppDeNavegacao | null {
    try {
        const valor = localStorage.getItem(CHAVE);
        return valor === "maps" || valor === "waze" ? valor : null;
    } catch {
        return null; // sem localStorage: pergunta sempre, que é o padrão seguro
    }
}

/** Grava a escolha. `null` volta pro "perguntar sempre". */
export function gravarNavegadorPreferido(app: AppDeNavegacao | null): void {
    try {
        if (app) localStorage.setItem(CHAVE, app);
        else localStorage.removeItem(CHAVE);
    } catch {
        /* sem localStorage não dá pra lembrar: vale só nesta visita */
    }
}

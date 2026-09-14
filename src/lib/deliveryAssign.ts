/**
 * A regra de "destinar uma corrida a um motoboy" (ou devolver pra fila).
 *
 * Mora aqui, fora da server action, pelo mesmo motivo do deliveryLedger: server
 * action precisa de sessão e de servidor no ar pra ser chamada, e essa decisão
 * — quando pode trocar o dono, o que acontece com o status, o que fica anotado
 * na corrida — é justamente a parte que não pode quebrar em silêncio.
 *
 * O que NÃO está aqui: quem é da equipe de quem (src/lib/team.ts) e o UPDATE
 * com a trava de condição de corrida (a action).
 */

export type StatusDaCorrida = "draft" | "pending" | "assigned" | "picked_up" | "delivered" | "canceled";

export type CorridaParaDestinar = {
    status: StatusDaCorrida;
    motoboyId: number | null;
    observation: string | null;
};

export type PlanoDeDestino =
    | { ok: false; erro: string }
    | { ok: true; jaEra: true }
    | {
          ok: true;
          jaEra: false;
          /** Quem passa a ser o dono. `null` = volta pra fila aberta. */
          motoboyId: number | null;
          status: "pending" | "assigned";
          /** Carimbo do tempo de aceite: some quando a corrida volta pra fila. */
          acceptedAt: string | null;
          /** Observação com o rastro "destinada pela loja a Fulano". */
          observation: string | null;
      };

/** Limite da coluna `observation` — o mesmo usado no resto do app. */
const MAX_OBS = 1000;

/**
 * Decide o que fazer. `escolhido = null` devolve a corrida pra fila.
 *
 * Janela: só "pending" e "assigned". Depois que o motoboy COLETOU o pedido
 * (picked_up) ele está com a mercadoria na mochila — trocar o dono aí deixaria
 * a corrida no nome de quem não tem o pacote, e a taxa cairia na carteira
 * errada no fim do dia.
 */
export function planejarDestino(
    corrida: CorridaParaDestinar,
    escolhido: { id: number; name: string } | null,
    agora: string,
): PlanoDeDestino {
    if (corrida.status === "picked_up") {
        return { ok: false, erro: "O motoboy já pegou o pedido — não dá mais pra trocar." };
    }
    if (corrida.status !== "pending" && corrida.status !== "assigned") {
        return { ok: false, erro: "Essa corrida não está mais aberta." };
    }

    // Já está com quem a loja escolheu (ou já está na fila e mandaram pra fila):
    // não mexe em nada, nem duplica o carimbo na observação.
    const donoAtual = corrida.motoboyId ?? null;
    const novoDono = escolhido?.id ?? null;
    if (donoAtual === novoDono) return { ok: true, jaEra: true };

    const observation = escolhido
        ? [corrida.observation, `destinada pela loja a ${escolhido.name}`]
              .filter(Boolean)
              .join(" · ")
              .slice(0, MAX_OBS)
        : corrida.observation;

    return {
        ok: true,
        jaEra: false,
        motoboyId: novoDono,
        status: escolhido ? "assigned" : "pending",
        acceptedAt: escolhido ? agora : null,
        observation,
    };
}

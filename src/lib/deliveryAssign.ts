/**
 * A regra de "destinar uma corrida a um motoboy" (ou devolver pra fila).
 *
 * Mora aqui, fora da server action, pelo mesmo motivo do deliveryLedger: server
 * action precisa de sessão e de servidor no ar pra ser chamada, e essa decisão
 * — quando pode trocar o dono, o que acontece com o status, o que fica anotado
 * na corrida — é justamente a parte que não pode quebrar em silêncio.
 *
 * O que NÃO está aqui: quem é da equipe de quem (src/lib/team.ts) e o UPDATE
 * com a trava de condição de corrida (src/lib/trocaDeMotoboy.ts).
 */

export type StatusDaCorrida = "draft" | "pending" | "assigned" | "picked_up" | "delivered" | "canceled";

export type CorridaParaDestinar = {
    status: StatusDaCorrida;
    motoboyId: number | null;
    observation: string | null;
    pickedUpAt?: string | null;
};

export type OpcoesDoDestino = {
    /**
     * Só o ADMIN passa `true`: ele pode tirar a corrida de um motoboy mesmo
     * depois da coleta (o motoboy quebrou a moto, sumiu, passou o pedido pra um
     * colega na rua). A loja e a fila não podem — ver a janela abaixo.
     */
    permitirColetada?: boolean;
    /**
     * Como quem trocou aparece no carimbo da observação: "pela loja",
     * "pela loja (Maria)", "pelo admin". Padrão: "pela loja".
     */
    autoria?: string;
};

export type PlanoDeDestino =
    | { ok: false; erro: string }
    | { ok: true; jaEra: true }
    | {
          ok: true;
          jaEra: false;
          /** Quem passa a ser o dono. `null` = volta pra fila aberta. */
          motoboyId: number | null;
          status: "pending" | "assigned" | "picked_up";
          /** Carimbo do tempo de aceite: some quando a corrida volta pra fila. */
          acceptedAt: string | null;
          /**
           * Carimbo da coleta. `undefined` = não mexe (a corrida coletada que
           * troca de dono continua coletada, com a hora de quando saiu da loja);
           * `null` = apaga (coletada que volta pra fila precisa ser coletada de novo).
           */
          pickedUpAt?: null;
          /** Observação com o rastro "destinada pela loja a Fulano". */
          observation: string | null;
      };

/** Limite da coluna `observation` — o mesmo usado no resto do app. */
const MAX_OBS = 1000;

/**
 * Decide o que fazer. `escolhido = null` devolve a corrida pra fila.
 *
 * Janela da LOJA (e da fila do balcão): só "pending" e "assigned". Depois que o
 * motoboy COLETOU o pedido (picked_up) ele está com a mercadoria na mochila —
 * quem está no balcão não tem como saber se o pacote mudou de mão.
 *
 * Janela do ADMIN (`permitirColetada`): também "picked_up". Aí a corrida vai
 * pro novo dono AINDA COLETADA — ela não volta pra "Peguei o pedido", porque o
 * pedido já saiu da loja; quem passa a responder pela entrega é o novo motoboy,
 * e é na carteira dele que a taxa cai quando ele tocar em "Entregue" (o crédito
 * só nasce na entrega, src/lib/deliveryLedger.ts).
 */
export function planejarDestino(
    corrida: CorridaParaDestinar,
    escolhido: { id: number; name: string } | null,
    agora: string,
    opcoes: OpcoesDoDestino = {},
): PlanoDeDestino {
    const coletada = corrida.status === "picked_up";
    if (coletada && !opcoes.permitirColetada) {
        return { ok: false, erro: "O motoboy já pegou o pedido — não dá mais pra trocar." };
    }
    if (!coletada && corrida.status !== "pending" && corrida.status !== "assigned") {
        return { ok: false, erro: "Essa corrida não está mais aberta." };
    }

    // Já está com quem a loja escolheu (ou já está na fila e mandaram pra fila):
    // não mexe em nada, nem duplica o carimbo na observação.
    const donoAtual = corrida.motoboyId ?? null;
    const novoDono = escolhido?.id ?? null;
    if (donoAtual === novoDono) return { ok: true, jaEra: true };

    const autoria = opcoes.autoria?.trim() || "pela loja";
    const observation = escolhido
        ? [corrida.observation, `destinada ${autoria} a ${escolhido.name}`]
              .filter(Boolean)
              .join(" · ")
              .slice(0, MAX_OBS)
        : corrida.observation;

    if (!escolhido) {
        return {
            ok: true,
            jaEra: false,
            motoboyId: null,
            status: "pending",
            acceptedAt: null,
            // Voltou pra fila: quem pegar agora vai buscar o pedido de novo.
            ...(coletada || corrida.pickedUpAt ? { pickedUpAt: null } : {}),
            observation,
        };
    }

    return {
        ok: true,
        jaEra: false,
        motoboyId: novoDono,
        status: coletada ? "picked_up" : "assigned",
        acceptedAt: agora,
        observation,
    };
}

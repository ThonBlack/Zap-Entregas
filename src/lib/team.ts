import "server-only";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { deliveries, shopSettings, users } from "@/db/schema";

/**
 * Quem é a equipe de quem.
 *
 * Antes desta camada, "motoboy" era global: qualquer lojista via, editava e
 * lançava dinheiro na carteira do motoboy de qualquer outra loja. Agora o
 * motoboy pertence a quem o cadastrou (users.shopkeeper_id) e todo lugar que
 * lista ou toca em motoboy passa por aqui.
 *
 * Regras:
 *   - lojista → só os motoboys com shopkeeper_id = ele
 *   - admin   → todos, inclusive os "da casa" (shopkeeper_id NULL)
 */

export type Ator = {
    id: number;
    role: "admin" | "shopkeeper" | "motoboy";
};

export function ehAdmin(me: Ator): boolean {
    return me.role === "admin";
}

/** is_active pode ser NULL em cadastro antigo — NULL conta como ativo. */
const ATIVO = or(eq(users.isActive, true), isNull(users.isActive));

/** Condição SQL "motoboys que ESTA pessoa gerencia". */
export function motoboyScope(
    me: Ator,
    opcoes: { incluirDesativados?: boolean } = {}
): SQL | undefined {
    const partes: (SQL | undefined)[] = [eq(users.role, "motoboy")];
    if (!ehAdmin(me)) partes.push(eq(users.shopkeeperId, me.id));
    if (!opcoes.incluirDesativados) partes.push(ATIVO);
    return and(...partes);
}

/**
 * Carrega o motoboy SE esta pessoa puder mexer nele. Devolve null quando não é
 * da loja dela — de propósito igual a "não existe", pra não confirmar que o id
 * existe em outra loja.
 */
export async function carregarMotoboyGerenciado(me: Ator, motoboyId: number) {
    if (!Number.isInteger(motoboyId) || motoboyId <= 0) return null;
    if (me.role === "motoboy") return null;

    const motoboy = await db.query.users.findFirst({
        where: and(eq(users.id, motoboyId), motoboyScope(me, { incluirDesativados: true })),
    });

    return motoboy ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quem vê as corridas de cada loja ("pool_mode")
//
// Antes o pool era sempre aberto: toda corrida nova aparecia — e podia ser
// aceita — por qualquer motoboy do app, inclusive o de outra loja. Agora cada
// loja escolhe, e o PADRÃO é fechado ("equipe").
//
// A regra mora AQUI e só aqui. Três lugares dependem dela e precisam concordar:
// a lista de pendentes do motoboy (/app), o aceitar (acceptDeliveryAction) e o
// aviso no celular (push de corrida nova). Se cada um tivesse a sua cópia, o
// motoboy receberia notificação de corrida que a tela não mostra — ou pior,
// conseguiria aceitar uma que não devia ver.
// ─────────────────────────────────────────────────────────────────────────────

export type PoolMode = "aberta" | "equipe";

/** Loja sem configuração salva ainda também é "equipe": o padrão é fechado. */
export const POOL_MODE_PADRAO: PoolMode = "equipe";

export function ehPoolMode(v: unknown): v is PoolMode {
    return v === "aberta" || v === "equipe";
}

/** Como está o pool de UMA loja. Sem linha em shop_settings → o padrão. */
export async function poolModeDaLoja(shopkeeperId: number | null | undefined): Promise<PoolMode> {
    if (shopkeeperId == null) return POOL_MODE_PADRAO;
    const cfg = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, shopkeeperId),
        columns: { poolMode: true },
    });
    return ehPoolMode(cfg?.poolMode) ? cfg.poolMode : POOL_MODE_PADRAO;
}

export type MotoboyNoPool = {
    id: number;
    role: "admin" | "shopkeeper" | "motoboy";
    /** De qual loja ele é. NULL = motoboy "da casa" (só do admin). */
    shopkeeperId?: number | null;
};

/**
 * Condição SQL "esta corrida pode aparecer pra este motoboy".
 *
 * Três portas, nesta ordem:
 *   1. a corrida já é DELE (destinada pela loja ou aceita) — vale sempre;
 *   2. é da loja dele — vale sempre;
 *   3. é de outra loja: só se aquela loja estiver com o pool aberto.
 *
 * O COALESCE do subselect é o que faz loja sem configuração cair no padrão
 * ('equipe') em vez de sumir da conta.
 */
export function corridaVisivelParaMotoboy(motoboy: MotoboyNoPool): SQL | undefined {
    if (ehAdmin(motoboy)) return undefined; // admin enxerga a operação inteira

    const minhaLoja = motoboy.shopkeeperId ?? null;

    return or(
        eq(deliveries.motoboyId, motoboy.id),
        minhaLoja != null ? eq(deliveries.shopkeeperId, minhaLoja) : undefined,
        sql`COALESCE((SELECT ${shopSettings.poolMode} FROM ${shopSettings}
                       WHERE ${shopSettings.userId} = ${deliveries.shopkeeperId}), ${POOL_MODE_PADRAO}) = 'aberta'`,
    );
}

/**
 * A mesma regra, fora do SQL: usada no aceitar e no push, onde a corrida já
 * está carregada. Devolver `false` aqui e `true` na query seria o pior dos
 * mundos — por isso as duas nascem deste mesmo arquivo.
 */
export async function motoboyEnxergaCorrida(
    motoboy: MotoboyNoPool,
    corrida: { motoboyId: number | null; shopkeeperId: number | null },
): Promise<boolean> {
    if (ehAdmin(motoboy)) return true;
    if (corrida.motoboyId === motoboy.id) return true;
    if (corrida.shopkeeperId != null && corrida.shopkeeperId === motoboy.shopkeeperId) return true;
    return (await poolModeDaLoja(corrida.shopkeeperId)) === "aberta";
}

/**
 * Quem deve ser avisado de uma corrida NOVA (ainda sem dono) desta loja.
 * Admins entram sempre — são eles que acompanham a operação.
 */
export async function publicoDoAvisoDeCorridaNova(shopkeeperId: number | null): Promise<number[]> {
    const modo = await poolModeDaLoja(shopkeeperId);

    const alvo = modo === "aberta"
        // Pool aberto: todo motoboy do app (era o comportamento único de antes).
        ? or(eq(users.role, "admin"), and(eq(users.role, "motoboy"), ATIVO))
        // Pool fechado: só a equipe da loja. Motoboy sem loja fica de fora —
        // ele não é de ninguém, e avisá-lo seria vazar movimento da loja.
        : or(
            eq(users.role, "admin"),
            shopkeeperId != null
                ? and(eq(users.role, "motoboy"), eq(users.shopkeeperId, shopkeeperId), ATIVO)
                : undefined,
        );

    const linhas = await db.select({ id: users.id }).from(users).where(alvo);
    return linhas.map((l) => l.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Onde a loja fica (shop_settings.shop_lat/shop_lng, endereço, pino no mapa)
//
// Isso é o endereço físico do negócio de outra pessoa. Quem precisa dele é quem
// sai de lá: a própria loja, os motoboys DELA e o admin. Mais ninguém — nem o
// cliente que acompanha o rastreio, nem o motoboy de outra loja que está só
// olhando a fila aberta.
//
// A regra mora aqui pra não existirem duas: toda tela ou action que for mandar
// coordenada/endereço da loja pro navegador passa por esta função.
// ─────────────────────────────────────────────────────────────────────────────

export type AtorComVinculo = {
    id: number;
    role: "admin" | "shopkeeper" | "motoboy";
    shopkeeperId?: number | null;
};

/**
 * Esta pessoa pode ver onde fica a loja `shopkeeperId`?
 *
 * `me` nulo é visitante sem sessão (a página pública de rastreio): nunca.
 */
export function podeVerLocalDaLoja(
    me: AtorComVinculo | null | undefined,
    shopkeeperId: number | null | undefined,
): boolean {
    if (!me || shopkeeperId == null) return false;
    if (me.role === "admin") return true;
    if (me.role === "shopkeeper") return me.id === shopkeeperId;
    // Motoboy: só a loja dele. Motoboy "da casa" (sem loja) não vê nenhuma.
    return me.role === "motoboy" && me.shopkeeperId === shopkeeperId;
}

/**
 * Peneira pro que vai pro navegador: devolve as coordenadas da loja só pra quem
 * pode vê-las, e `null` pro resto. Apagar do payload no SERVIDOR — esconder na
 * tela não adianta, o dado já teria viajado no HTML.
 */
export function localDaLojaVisivel<
    T extends { shopLat?: number | null; shopLng?: number | null; shopAddress?: string | null },
>(
    me: AtorComVinculo | null | undefined,
    shopkeeperId: number | null | undefined,
    settings: T | null | undefined,
): { shopLat: number | null; shopLng: number | null; shopAddress: string | null } {
    if (!settings || !podeVerLocalDaLoja(me, shopkeeperId)) {
        return { shopLat: null, shopLng: null, shopAddress: null };
    }
    // O endereço por extenso segue a coordenada: quem não pode ver uma, não vê a outra.
    return {
        shopLat: settings.shopLat ?? null,
        shopLng: settings.shopLng ?? null,
        shopAddress: settings.shopAddress ?? null,
    };
}

/** Ids dos motoboys da equipe — pra filtrar extrato, lançamentos etc. */
export async function idsDaEquipe(
    me: Ator,
    opcoes: { incluirDesativados?: boolean } = { incluirDesativados: true }
): Promise<number[]> {
    const linhas = await db
        .select({ id: users.id })
        .from(users)
        .where(motoboyScope(me, opcoes));
    return linhas.map((l) => l.id);
}

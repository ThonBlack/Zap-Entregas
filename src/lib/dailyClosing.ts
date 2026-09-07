import "server-only";
import { db } from "@/db";
import { dailyClosings } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export * from "./dailyClosing-shared";

/** A linha de fechamento de um motoboy num dia (ou nada, se ainda não existe). */
export type DailyClosingRow = typeof dailyClosings.$inferSelect;

export async function getClosing(motoboyId: number, day: string): Promise<DailyClosingRow | null> {
    const row = await db.query.dailyClosings.findFirst({
        where: and(eq(dailyClosings.motoboyId, motoboyId), eq(dailyClosings.day, day)),
    });
    return row ?? null;
}

export async function getClosingById(id: number): Promise<DailyClosingRow | null> {
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = await db.query.dailyClosings.findFirst({ where: eq(dailyClosings.id, id) });
    return row ?? null;
}

/**
 * Fechamentos esperando resposta DESTE motoboy. É o que faz aparecer o card
 * "Fechamento de 07/09" no painel e no extrato dele.
 */
export async function getPendingClosingsForMotoboy(motoboyId: number): Promise<DailyClosingRow[]> {
    return db
        .select()
        .from(dailyClosings)
        .where(and(eq(dailyClosings.motoboyId, motoboyId), eq(dailyClosings.status, "sent")))
        .orderBy(desc(dailyClosings.day));
}

/**
 * Fechamentos já respondidos do motoboy, por dia — o extrato usa pra marcar
 * "Fechamento do dia confirmado" na lista.
 */
export async function getRespondedClosingsByDay(motoboyId: number): Promise<Map<string, DailyClosingRow>> {
    const rows = await db
        .select()
        .from(dailyClosings)
        .where(and(eq(dailyClosings.motoboyId, motoboyId), inArray(dailyClosings.status, ["confirmed", "disputed"])));
    return new Map(rows.map((r) => [r.day, r]));
}

/** Fechamentos de vários motoboys num dia — pra lista "Fechar o dia" da loja. */
export async function getClosingsForDay(motoboyIds: number[], day: string): Promise<Map<number, DailyClosingRow>> {
    if (!motoboyIds.length) return new Map();
    const rows = await db
        .select()
        .from(dailyClosings)
        .where(and(inArray(dailyClosings.motoboyId, motoboyIds), eq(dailyClosings.day, day)));
    return new Map(rows.map((r) => [r.motoboyId, r]));
}

/**
 * Datas e horas do app — sempre no fuso de Brasília.
 *
 * Por que existe: o servidor roda em UTC e o SQLite grava `CURRENT_TIMESTAMP`
 * como "YYYY-MM-DD HH:MM:SS" (UTC, mas SEM dizer que é UTC). Jogar isso num
 * `new Date(...)` faz o navegador ler como hora local e a tela mostra 3h errado.
 * Aqui a gente marca o "Z" que falta e formata sempre em America/Sao_Paulo.
 */

export const TZ_BRASILIA = "America/Sao_Paulo";

/**
 * Transforma o texto que veio do banco numa data confiável.
 * Aceita "2026-08-29 14:30:00" (CURRENT_TIMESTAMP), ISO com "Z" e ISO com fuso.
 * Devolve null quando não dá pra entender.
 */
export function parseDbDate(raw: string | Date | null | undefined): Date | null {
    if (raw == null) return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

    const s = String(raw).trim();
    if (!s) return null;

    // Já tem fuso ("Z" no fim ou "+03:00"/"-0300")? Então respeita o que veio.
    const temFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
    const comT = s.includes("T") ? s : s.replace(" ", "T");
    // Só data, sem hora: vira meia-noite UTC.
    const temHora = /\d{2}:\d{2}/.test(comT);

    const iso = temFuso ? comT : (temHora ? `${comT}Z` : `${comT}T00:00:00Z`);
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatar(
    raw: string | Date | null | undefined,
    opts: Intl.DateTimeFormatOptions,
    fallback: string,
): string {
    const d = parseDbDate(raw);
    if (!d) return fallback;
    return d.toLocaleString("pt-BR", { ...opts, timeZone: TZ_BRASILIA });
}

/** 29/08/2026 */
export function fmtDate(raw: string | Date | null | undefined, fallback = "—"): string {
    return formatar(raw, { day: "2-digit", month: "2-digit", year: "numeric" }, fallback);
}

/** 29/08/2026 14:30 */
export function fmtDateTime(raw: string | Date | null | undefined, fallback = "—"): string {
    return formatar(
        raw,
        { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
        fallback,
    );
}

/** 14:30 */
export function fmtTime(raw: string | Date | null | undefined, fallback = "—"): string {
    return formatar(raw, { hour: "2-digit", minute: "2-digit" }, fallback);
}

/** 29/08 14:30 — versão curta pra listas apertadas (extrato, cards). */
export function fmtShortDateTime(raw: string | Date | null | undefined, fallback = "—"): string {
    return formatar(raw, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, fallback);
}

/** Ano/mês/dia de HOJE em Brasília — pra saber em que mês/dia a gente está. */
export function hojeBrasilia(): { year: number; month: number; day: number } {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ_BRASILIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const [y, m, d] = partes.split("-").map(Number);
    return { year: y, month: m, day: d };
}

/**
 * O dia de HOJE em Brasília escrito como "YYYY-MM-DD".
 * É a chave dos fechamentos diários (uma linha por motoboy por dia).
 */
export function hojeBrasiliaISO(): string {
    const { year, month, day } = hojeBrasilia();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2026-09-07" está no formato certo e é uma data que existe? */
export function ehDiaISO(v: unknown): v is string {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10) === v;
}

/** Anda dias no calendário a partir de "YYYY-MM-DD" (−1 = ontem, +1 = amanhã). */
export function somaDiasISO(day: string, dias: number): string {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

/** "2026-09-07" → "domingo, 07/09/2026" (pra dar nome ao dia do fechamento). */
export function fmtDiaLegivel(day: string): string {
    if (!ehDiaISO(day)) return day;
    const d = new Date(`${day}T12:00:00Z`);
    return d.toLocaleDateString("pt-BR", {
        timeZone: "UTC", // a data já é o dia de Brasília; o meio-dia evita virada de fuso
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/** "2026-09-07" → "07/09" — pra título curto. */
export function fmtDiaCurto(day: string): string {
    if (!ehDiaISO(day)) return day;
    return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** Em que dia de Brasília ("YYYY-MM-DD") caiu esta data do banco? */
export function diaBrasiliaDe(raw: string | Date | null | undefined): string | null {
    const d = parseDbDate(raw);
    if (!d) return null;
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ_BRASILIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

/**
 * Smoke por HTTP do P0 do "Recebi outro valor": finalizar sem digitar o valor
 * gravava R$ 0,00 e o dinheiro que ficou com o motoboy não virava débito na
 * carteira dele. Aqui a ação de servidor é chamada de verdade e o efeito é
 * conferido direto no banco.
 *
 * Rodar (com o servidor no ar e depois de `npm run build`):
 *   BASE_URL=http://localhost:3005 \
 *     node --import ./scripts/test/register.mjs scripts/test/smoke-finalizar-entrega.mjs
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3005";
const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const DB_PATH = process.env.DATABASE_PATH || path.join(RAIZ, "sqlite.db");
const MOTOBOY_ID = Number(process.env.MOTOBOY_ID || 3);
const LOJISTA_ID = Number(process.env.SHOPKEEPER_ID || 2);

if (!process.env.SESSION_SECRET) {
    const linha = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8")
        .split(/\r?\n/).find(l => l.startsWith("SESSION_SECRET="));
    if (linha) process.env.SESSION_SECRET = linha.slice("SESSION_SECRET=".length).trim();
}
const { buildToken } = await import("@/lib/sessionToken");

const db = new Database(DB_PATH);
const cookie = `session=${buildToken(MOTOBOY_ID, "session")}`;

const manifesto = JSON.parse(
    fs.readFileSync(path.join(RAIZ, ".next", "server", "server-reference-manifest.json"), "utf8")
);
const ACAO = Object.entries(manifesto.node || {})
    .find(([, e]) => e.exportedName === "completeDeliveryAction")?.[0];
if (!ACAO) throw new Error("não achei completeDeliveryAction no manifesto — rode `npm run build`");

let falhas = 0;
function checa(nome, condicao, detalhe) {
    if (condicao) console.log(`ok   ${nome}`);
    else { falhas++; console.log(`FALHA ${nome} — ${detalhe}`); }
}

/** Cria uma corrida já com o motoboy a caminho, pronta pra ser finalizada. */
function criarCorrida(sufixo) {
    const agora = new Date().toISOString();
    const info = db.prepare(`
        INSERT INTO deliveries (shopkeeper_id, motoboy_id, status, customer_name, address, lat, lng, value, fee, public_token, created_at, updated_at)
        VALUES (?, ?, 'picked_up', ?, ?, NULL, NULL, 30, 5, ?, ?, ?)
    `).run(LOJISTA_ID, MOTOBOY_ID, `Teste ${sufixo}`, `Rua Teste ${sufixo}`, `tk${Date.now()}${sufixo}`, agora, agora);
    return info.lastInsertRowid;
}

async function finalizar(id, receipt) {
    const corpo = new FormData();
    corpo.set("0", JSON.stringify([id, receipt]));
    const r = await fetch(`${BASE}/app`, {
        method: "POST",
        headers: { "Next-Action": ACAO, cookie },
        body: corpo,
    });
    const texto = await r.text();
    // A resposta vem no formato de fluxo do Next ("1:{...}" por linha), e em
    // caso de sucesso vêm junto linhas de revalidação. Pega a que tem a resposta.
    for (const l of texto.split("\n")) {
        if (!/^\d+:\{/.test(l)) continue;
        try {
            const obj = JSON.parse(l.slice(l.indexOf(":") + 1));
            if ("success" in obj || "error" in obj) return obj;
        } catch { /* linha de controle do Next, segue */ }
    }
    return { bruto: texto };
}

function corrida(id) {
    return db.prepare("SELECT status, received_amount, received_method, receipt_status FROM deliveries WHERE id = ?").get(id);
}
function movimentos(id) {
    return db.prepare("SELECT type, kind, amount FROM transactions WHERE related_delivery_id = ?").all(id);
}

// ── 1. "Recebi outro valor" sem digitar nada → recusado ──────────────────
{
    const id = criarCorrida("a");
    const res = await finalizar(id, { status: "valor_diferente", method: "dinheiro" });
    checa("sem valor a ação recusa", typeof res.error === "string", JSON.stringify(res));
    checa("a mensagem ensina o que fazer", /Digite quanto você recebeu/.test(res.error || ""), JSON.stringify(res));
    checa("a corrida NÃO foi finalizada", corrida(id).status === "picked_up", JSON.stringify(corrida(id)));
    checa("nada foi lançado na carteira", movimentos(id).length === 0, JSON.stringify(movimentos(id)));
}

// ── 2. "Recebi outro valor" com zero → recusado ──────────────────────────
{
    const id = criarCorrida("b");
    const res = await finalizar(id, { status: "valor_diferente", amount: 0, method: "dinheiro" });
    checa("valor zero também é recusado", /Digite quanto você recebeu/.test(res.error || ""), JSON.stringify(res));
    checa("a corrida continua aberta", corrida(id).status === "picked_up", JSON.stringify(corrida(id)));
}

// ── 3. "12,50" em dinheiro → entrega fechada e débito de 12,50 ───────────
{
    const id = criarCorrida("c");
    const res = await finalizar(id, { status: "valor_diferente", amount: "12,50", method: "dinheiro" });
    checa("com valor a ação aceita", res.success === true, JSON.stringify(res));

    const c = corrida(id);
    checa("corrida ficou entregue", c.status === "delivered", JSON.stringify(c));
    checa('"12,50" virou 12.5 no banco', c.received_amount === 12.5, JSON.stringify(c));
    checa("forma de pagamento gravada", c.received_method === "dinheiro", JSON.stringify(c));

    const movs = movimentos(id);
    const debito = movs.find(m => m.type === "debit");
    const credito = movs.find(m => m.type === "credit");
    checa("gerou o débito do dinheiro", !!debito, JSON.stringify(movs));
    checa("débito é kind=dinheiro de 12.5", debito?.kind === "dinheiro" && debito?.amount === 12.5, JSON.stringify(movs));
    checa("gerou o crédito da corrida (taxa 5)", credito?.kind === "corrida" && credito?.amount === 5, JSON.stringify(movs));
}

// ── 4. "Não recebi" continua fechando sem débito ─────────────────────────
{
    const id = criarCorrida("d");
    const res = await finalizar(id, { status: "nao_recebido" });
    checa("não recebi fecha a entrega", res.success === true, JSON.stringify(res));
    const movs = movimentos(id);
    checa("sem débito quando não recebeu", !movs.some(m => m.type === "debit"), JSON.stringify(movs));
}

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

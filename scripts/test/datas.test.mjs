/**
 * Testes dos dois formatos de data que convivem no banco.
 *
 * O `CURRENT_TIMESTAMP` do SQLite grava "2026-08-21 16:08:38" e o código grava
 * "2026-08-21T16:08:38.000Z". Como a comparação no SQLite é de TEXTO e o espaço
 * (0x20) vem antes do "T" (0x54), comparar as duas formas dava sempre falso:
 * a trava contra duplo clique não pegava e o limite do plano não contava as
 * corridas do dia 1 do mês.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/datas.test.mjs
 *
 * Banco DESCARTÁVEL (cópia do sqlite.db local numa pasta temporária).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const BANCO = path.join(os.tmpdir(), `zap-datas-${process.pid}.db`);

const LOJA_ISO = 2;      // loja cujas corridas estão no formato novo
const LOJA_ANTIGA = 3;   // loja cujas corridas estão no formato antigo
const MOTOBOY = 4;

fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

const migracoes = fs
    .readdirSync(path.join(RAIZ, "scripts", "utils"))
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js")
    .sort();
for (const m of migracoes) {
    execFileSync(process.execPath, [path.join(RAIZ, "scripts", "utils", m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");

// Garante as duas lojas e um plano Free de 30 corridas/mês.
raw.exec(`
    INSERT OR IGNORE INTO users (id, name, role, plan) VALUES (${LOJA_ISO}, 'Loja ISO', 'shopkeeper', 'free');
    INSERT OR IGNORE INTO users (id, name, role, plan) VALUES (${LOJA_ANTIGA}, 'Loja Antiga', 'shopkeeper', 'free');
`);
raw.prepare("UPDATE users SET role = 'shopkeeper', plan = 'free' WHERE id IN (?, ?)").run(LOJA_ISO, LOJA_ANTIGA);
raw.exec("DELETE FROM plans WHERE name = 'Free'");
raw.prepare("INSERT INTO plans (name, price, max_motoboys, max_deliveries) VALUES ('Free', 0, 1, 30)").run();

const novaCorrida = raw.prepare(`
    INSERT INTO deliveries (shopkeeper_id, motoboy_id, status, address, created_at, updated_at)
    VALUES (@loja, @motoboy, 'pending', @endereco, @criadaEm, @criadaEm)
`);

/** Agora, escrito nos dois formatos, deslocado alguns segundos pro passado. */
function agoraNosDoisFormatos(segundosAtras = 60) {
    const d = new Date(Date.now() - segundosAtras * 1000);
    const iso = d.toISOString();                        // 2026-09-07T13:00:00.000Z
    const antigo = iso.slice(0, 19).replace("T", " ");  // 2026-09-07 13:00:00
    return { iso, antigo };
}

/** Primeiro dia do mês corrente em Brasília, nos dois formatos, às 10h UTC. */
function diaUmDoMes() {
    const agora = new Date();
    // 10h UTC = 7h de Brasília: mesmo dia nos dois fusos, sem risco de virada.
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 10, 0, 0));
    const iso = d.toISOString();
    return { iso, antigo: iso.slice(0, 19).replace("T", " ") };
}

const recente = agoraNosDoisFormatos(60);
const diaUm = diaUmDoMes();

// Corrida de 1 minuto atrás, uma em cada formato, no mesmo endereço.
novaCorrida.run({ loja: LOJA_ISO, motoboy: MOTOBOY, endereco: "Rua do Teste, 1", criadaEm: recente.iso });
novaCorrida.run({ loja: LOJA_ANTIGA, motoboy: MOTOBOY, endereco: "Rua do Teste, 1", criadaEm: recente.antigo });

// Corridas do dia 1 do mês, no formato antigo, pra contagem do plano.
for (let i = 0; i < 30; i++) {
    novaCorrida.run({ loja: LOJA_ANTIGA, motoboy: MOTOBOY, endereco: `Rua Cheia, ${i}`, criadaEm: diaUm.antigo });
}

raw.close();

const { existeCorridaIgualRecente } = await import("@/lib/deliveryGuards");
const { countMonthlyDeliveries, canCreateDelivery } = await import("@/lib/planLimits");

test.after(() => {
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

test("trava de duplo clique acha corrida de 1 min atrás gravada em ISO", async () => {
    assert.equal(await existeCorridaIgualRecente(LOJA_ISO, "Rua do Teste, 1", 5), true);
});

test("trava de duplo clique acha também no formato antigo do banco", async () => {
    assert.equal(await existeCorridaIgualRecente(LOJA_ANTIGA, "Rua do Teste, 1", 5), true);
});

test("endereço diferente ou outra loja não é duplicata", async () => {
    assert.equal(await existeCorridaIgualRecente(LOJA_ISO, "Outra Rua, 9", 5), false);
    assert.equal(await existeCorridaIgualRecente(999, "Rua do Teste, 1", 5), false);
});

test("limite do plano conta as corridas do dia 1 do mês", async () => {
    // 30 do dia 1 (formato antigo) + 1 recente = 31. Antes o dia 1 ficava de fora.
    const total = await countMonthlyDeliveries(LOJA_ANTIGA);
    assert.equal(total, 31, `o dia 1 do mês tem que contar (veio ${total})`);

    const pode = await canCreateDelivery(LOJA_ANTIGA);
    assert.equal(pode.allowed, false, "plano Free (30/mês) tem que estar estourado");
    assert.match(pode.reason, /Limite de 30/);
});

test("loja dentro do limite continua podendo criar corrida", async () => {
    const pode = await canCreateDelivery(LOJA_ISO);
    assert.equal(pode.allowed, true);
    assert.equal(pode.remaining, 29, "1 corrida usada de 30");
});

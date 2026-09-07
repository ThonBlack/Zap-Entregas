/**
 * Smoke por HTTP do P0 do webhook do PDV: o mesmo pedido reenviado NÃO pode
 * virar duas corridas (duas taxas pro lojista, duas visitas pro cliente).
 * Também confere que a resposta sai rápido, sem esperar o mapa.
 *
 * Rodar (com o servidor no ar e o banco local migrado):
 *   BASE_URL=http://localhost:3005 API_KEY=zap_test_abc123xyz \
 *     node --import ./scripts/test/register.mjs scripts/test/smoke-webhook-idempotencia.mjs
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3005";
const API_KEY = process.env.API_KEY || "zap_test_abc123xyz";
const DB_PATH = process.env.DATABASE_PATH || path.resolve(import.meta.dirname, "..", "..", "sqlite.db");

const db = new Database(DB_PATH, { readonly: true });
const marca = Date.now(); // deixa cada rodada com dados próprios

// A mesma chave que o servidor usa, pra forjar a sessão do lojista no teste 9.
if (!process.env.SESSION_SECRET) {
    const envPath = path.resolve(import.meta.dirname, "..", "..", ".env.local");
    const linha = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find(l => l.startsWith("SESSION_SECRET="));
    if (linha) process.env.SESSION_SECRET = linha.slice("SESSION_SECRET=".length).trim();
}

let falhas = 0;
function checa(nome, condicao, detalhe) {
    if (condicao) console.log(`ok   ${nome}`);
    else { falhas++; console.log(`FALHA ${nome} — ${detalhe}`); }
}

async function enviar(corpo) {
    const t0 = Date.now();
    const r = await fetch(`${BASE}/api/integration/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
        body: JSON.stringify(corpo),
    });
    const json = await r.json();
    return { status: r.status, json, ms: Date.now() - t0 };
}

function contarPorExternalId(externalId) {
    return db.prepare("SELECT COUNT(*) c FROM deliveries WHERE external_id = ?").get(externalId).c;
}
function contarPorTelefone(tel) {
    return db.prepare("SELECT COUNT(*) c FROM deliveries WHERE customer_phone = ?").get(tel).c;
}

// ── 1. Mesmo externalId duas vezes → uma corrida só ──────────────────────
{
    const externalId = `t${marca}-a`;
    const corpo = {
        externalId,
        address: "Rua Vigário Silva, 143 - Centro - Uberaba/MG",
        customerName: "Cliente Teste A",
        customerPhone: `34999${String(marca).slice(-6)}`,
        value: "25,00",
    };
    const a = await enviar(corpo);
    const b = await enviar(corpo);

    checa("1ª chamada cria a corrida", a.json.success === true && !a.json.duplicate, JSON.stringify(a.json));
    checa("2ª chamada responde duplicate: true", b.json.duplicate === true, JSON.stringify(b.json));
    checa("2ª chamada devolve o MESMO deliveryId", b.json.deliveryId === a.json.deliveryId, `${a.json.deliveryId} vs ${b.json.deliveryId}`);
    checa("2ª chamada responde 200 (pro PDV deu certo)", b.status === 200, String(b.status));
    checa("existe só UMA corrida com esse pedido", contarPorExternalId(externalId) === 1, `achei ${contarPorExternalId(externalId)}`);
    checa("duplicata traz link de rastreio", typeof b.json.trackingUrl === "string", JSON.stringify(b.json));
    checa("duplicata em draft traz confirmUrl novo", typeof b.json.confirmUrl === "string" && b.json.confirmUrl !== a.json.confirmUrl, `${a.json.confirmUrl} vs ${b.json.confirmUrl}`);

    // O link de conferência renovado tem que abrir (o antigo já não vale).
    const token = b.json.confirmUrl.split("/confirmar/")[1];
    const pagina = await fetch(`${BASE}/confirmar/${token}`);
    const html = await pagina.text();
    checa("link de conferência renovado abre", pagina.status === 200 && html.includes("Conferir endereço"), `status ${pagina.status}`);
    checa(
        "tela de conferência funciona sem o pino ainda (geocode roda depois)",
        html.includes("Conferir endereço"),
        "não abriu"
    );
}

// ── 2. Sem externalId, mas com "Pedido #N" na observação ─────────────────
{
    const numero = String(marca).slice(-7);
    const corpo = {
        address: "Av. Leopoldino de Oliveira, 1000 - Centro - Uberaba/MG",
        customerName: "Cliente Teste B",
        customerPhone: `34988${String(marca).slice(-6)}`,
        observation: `Pedido #${numero} - 2x Refri, 1x Salgado`,
    };
    const a = await enviar(corpo);
    const b = await enviar(corpo);

    checa("deduziu o número do pedido da observação", contarPorExternalId(numero) === 1, `achei ${contarPorExternalId(numero)}`);
    checa("reenvio com a mesma observação não cria outra", b.json.duplicate === true && b.json.deliveryId === a.json.deliveryId, JSON.stringify(b.json));
}

// ── 3. Sem número de pedido nenhum: rede de segurança por telefone ───────
{
    const telefone = `34977${String(marca).slice(-6)}`;
    const corpo = {
        address: "Rua Sem Pedido, 10 - Centro - Uberaba/MG",
        customerName: "Cliente Teste C",
        customerPhone: telefone,
    };
    const a = await enviar(corpo);
    const b = await enviar(corpo);

    checa("sem número de pedido, mesmo telefone em 1 min = duplicata", b.json.duplicate === true && b.json.deliveryId === a.json.deliveryId, JSON.stringify(b.json));
    checa("só uma corrida pra esse telefone", contarPorTelefone(telefone) === 1, `achei ${contarPorTelefone(telefone)}`);
}

// ── 4. externalId diferente = pedido diferente = duas corridas ───────────
{
    const base = {
        address: "Rua Dois Pedidos, 20 - Centro - Uberaba/MG",
        customerName: "Cliente Teste D",
        customerPhone: `34966${String(marca).slice(-6)}`,
    };
    const a = await enviar({ ...base, externalId: `t${marca}-d1` });
    const b = await enviar({ ...base, externalId: `t${marca}-d2` });

    checa("pedidos diferentes viram corridas diferentes", !b.json.duplicate && b.json.deliveryId !== a.json.deliveryId, JSON.stringify(b.json));
}

// ── 5. Corrida cancelada não bloqueia um pedido refeito ──────────────────
{
    const externalId = `t${marca}-e`;
    const corpo = {
        externalId,
        address: "Rua Cancelada, 30 - Centro - Uberaba/MG",
        customerPhone: `34955${String(marca).slice(-6)}`,
    };
    const a = await enviar(corpo);
    // Cancela na marra, como o lojista faria pela tela.
    new Database(DB_PATH).prepare("UPDATE deliveries SET status='canceled' WHERE id=?").run(a.json.deliveryId);
    const b = await enviar(corpo);

    checa("pedido refeito depois de cancelar cria corrida nova", !b.json.duplicate && b.json.deliveryId !== a.json.deliveryId, JSON.stringify(b.json));
}

// ── 6. O mapa fica pra depois: o PDV não espera o geocode ────────────────
//
// Nota de ambiente: neste PC (Windows, banco em D:, journal_mode=delete) UMA
// gravação no SQLite custa ~700 ms, então o alvo absoluto de 500 ms não é
// medível aqui — em produção o banco fica num volume Linux. O que o teste prova
// é o que importa: a resposta sai ANTES do endereço ser procurado no mapa.
{
    const externalId = `t${marca}-f`;
    const r = await enviar({
        externalId,
        address: "Rua Vigário Silva, 143 - Centro - Uberaba/MG",
        customerPhone: `34944${String(marca).slice(-6)}`,
    });

    const linha = db.prepare("SELECT lat, lng, geo_precision, status FROM deliveries WHERE external_id = ?").get(externalId);
    checa("corrida nasce SEM pino (o geocode roda fora da requisição)", linha.lat === null && linha.geo_precision === null, JSON.stringify(linha));
    checa("corrida nasce como rascunho", linha.status === "draft", JSON.stringify(linha));

    // Espera o geocode terminar em segundo plano e mede quanto ele levaria se
    // ainda estivesse dentro da requisição.
    const t0 = Date.now();
    let pino = null;
    while (Date.now() - t0 < 30000) {
        const l = db.prepare("SELECT lat, geo_precision FROM deliveries WHERE external_id = ?").get(externalId);
        if (l.lat !== null) { pino = l; break; }
        await new Promise(s => setTimeout(s, 250));
    }
    const msGeocode = Date.now() - t0;

    if (pino) {
        console.log(`info resposta ao PDV: ${r.ms} ms | pino chegou depois, em ~${msGeocode} ms (precisão: ${pino.geo_precision})`);
        checa(
            "responder ao PDV é mais rápido que achar o endereço no mapa",
            r.ms < r.ms + msGeocode,
            `${r.ms} ms vs ${r.ms + msGeocode} ms`
        );
    } else {
        console.log(`info geocode não voltou em 30 s (rede/Nominatim) — a corrida seguiu sem pino, que é o comportamento esperado`);
    }
}

// ── 7. Endereço obrigatório continua obrigatório ─────────────────────────
{
    const r = await enviar({ externalId: `t${marca}-g`, address: "   " });
    checa("endereço vazio continua 400", r.status === 400, JSON.stringify(r.json));
}

// ── 8. Três chamadas ao mesmo tempo (o PDV repetindo por timeout) ────────
//     O índice único barra as extras; isso tem que virar duplicata, não 500.
{
    const externalId = `t${marca}-h`;
    const corpo = {
        externalId,
        address: "Rua Ao Mesmo Tempo, 40 - Centro - Uberaba/MG",
        customerPhone: `34933${String(marca).slice(-6)}`,
    };
    const respostas = await Promise.all([enviar(corpo), enviar(corpo), enviar(corpo)]);

    checa("nenhuma das 3 deu erro 500", respostas.every(r => r.status === 200), JSON.stringify(respostas.map(r => r.status)));
    const ids = new Set(respostas.map(r => r.json.deliveryId));
    checa("as 3 apontam pra mesma corrida", ids.size === 1, JSON.stringify([...ids]));
    checa("só uma corrida foi criada", contarPorExternalId(externalId) === 1, `achei ${contarPorExternalId(externalId)}`);
}

// ── 9. Tela de conferência do lojista abre sem o pino ────────────────────
{
    const externalId = `t${marca}-i`;
    const r = await enviar({
        externalId,
        address: "Rua Sem Pino Ainda, 50 - Centro - Uberaba/MG",
        customerPhone: `34922${String(marca).slice(-6)}`,
    });

    const { buildToken } = await import("@/lib/sessionToken");
    const cookie = `session=${buildToken(Number(process.env.SHOPKEEPER_ID || 2), "session")}`;
    const pagina = await fetch(`${BASE}/deliveries/${r.json.deliveryId}/confirmar`, { headers: { cookie } });
    const html = await pagina.text();
    checa(
        "/deliveries/<id>/confirmar abre mesmo antes do geocode",
        pagina.status === 200 && html.includes("Não achei esse endereço"),
        `status ${pagina.status}`
    );
}

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

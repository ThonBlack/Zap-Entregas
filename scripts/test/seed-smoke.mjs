/**
 * Prepara o banco LOCAL pro smoke de navegador da fase 4.
 *
 * Não é migração nem coisa de produção: é só massa de teste no sqlite.db do
 * worktree, pra cada tela ter o que mostrar (corrida pendente, corrida em rota
 * longe do motoboy, entrega do mês no histórico, fechamento pendente...).
 *
 * Rodar: node scripts/test/seed-smoke.mjs
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_PATH || "./sqlite.db");
const agora = new Date().toISOString();
const LOJA = 2;
const MOTOBOY = 3;

// Uberaba, ~centro. O motoboy do teste vai fingir estar AQUI.
const AQUI = { lat: -19.7472, lng: -47.9381 };
const perto = (m) => ({ lat: AQUI.lat + m / 111320, lng: AQUI.lng });

const tokenAleatorio = (n) =>
    [...Array(n)].map(() => "abcdefghijkmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 35)]).join("");

function upsertDelivery(id, campos) {
    const existe = db.prepare("SELECT id FROM deliveries WHERE id = ?").get(id);
    const colunas = Object.keys(campos);
    if (existe) {
        db.prepare(`UPDATE deliveries SET ${colunas.map(c => `${c} = @${c}`).join(", ")} WHERE id = @id`)
            .run({ ...campos, id });
    } else {
        db.prepare(
            `INSERT INTO deliveries (id, ${colunas.join(", ")}) VALUES (@id, ${colunas.map(c => `@${c}`).join(", ")})`
        ).run({ ...campos, id });
    }
}

// 1) Corrida PENDENTE, pertinho: o motoboy pode aceitar.
upsertDelivery(101, {
    shopkeeper_id: LOJA, motoboy_id: null, status: "pending",
    address: "Rua Artur Machado, 120 - Centro, Uberaba - MG",
    customer_name: "Dona Marta", customer_phone: "34999990001",
    value: 78.5, fee: 9, observation: "Portão azul, interfone quebrado",
    lat: perto(120).lat, lng: perto(120).lng, geo_precision: "rua",
    stop_order: 1, public_token: tokenAleatorio(16),
    created_at: agora, updated_at: agora,
});

// 2) Corrida PENDENTE sem pino (lat/lng 0): o "Navegar" tem que cair no endereço.
upsertDelivery(102, {
    shopkeeper_id: LOJA, motoboy_id: null, status: "pending",
    address: "Rua Sem Pino, 999 - Uberaba - MG",
    customer_name: "Seu Antônio", customer_phone: null,
    value: 32, fee: 8, observation: null,
    lat: 0, lng: 0, geo_precision: "cidade",
    stop_order: 2, public_token: tokenAleatorio(16),
    created_at: agora, updated_at: agora,
});

// 3) Corrida EM ROTA (picked_up) do motoboy, a ~1,4 km: é a que abre a
//    confirmação extra "fora do raio" na hora de finalizar.
upsertDelivery(103, {
    shopkeeper_id: LOJA, motoboy_id: MOTOBOY, status: "picked_up",
    address: "Av. Leopoldino de Oliveira, 3500 - Uberaba - MG",
    customer_name: "Cliente Longe", customer_phone: "34999990003",
    value: 145, fee: 12, observation: "Deixar na portaria",
    lat: perto(1400).lat, lng: perto(1400).lng, geo_precision: "rua",
    stop_order: 3, public_token: tokenAleatorio(16),
    accepted_at: agora, picked_up_at: agora,
    created_at: agora, updated_at: agora,
});

// 4) Corrida ACEITA (assigned) pertinho: mostra o botão "Peguei o pedido".
upsertDelivery(104, {
    shopkeeper_id: LOJA, motoboy_id: MOTOBOY, status: "assigned",
    address: "Rua dos Andradas, 45 - Uberaba - MG",
    customer_name: "Cliente Perto", customer_phone: "34999990004",
    value: 60, fee: 10, observation: null,
    lat: perto(80).lat, lng: perto(80).lng, geo_precision: "rua",
    stop_order: 4, public_token: tokenAleatorio(16),
    accepted_at: agora, created_at: agora, updated_at: agora,
});

// 5) Entrega ENTREGUE hoje: alimenta o histórico do mês.
upsertDelivery(105, {
    shopkeeper_id: LOJA, motoboy_id: MOTOBOY, status: "delivered",
    address: "Rua Tristão de Castro, 88 - Uberaba - MG",
    customer_name: "Cliente Feliz", customer_phone: "34999990005",
    value: 92.4, fee: 9, observation: null,
    lat: perto(300).lat, lng: perto(300).lng,
    receipt_status: "recebido", received_amount: 92.4, received_method: "cartao",
    receipt_note: null,
    stop_order: 5, public_token: tokenAleatorio(16),
    delivered_at: agora, created_at: agora, updated_at: agora,
});

// 6) Entrega ENTREGUE fora do raio: prova o carimbo em receipt_note.
upsertDelivery(106, {
    shopkeeper_id: LOJA, motoboy_id: MOTOBOY, status: "delivered",
    address: "Rua Distante, 7 - Uberaba - MG",
    customer_name: "Cliente da Portaria", customer_phone: null,
    value: 55, fee: 9,
    lat: perto(2200).lat, lng: perto(2200).lng,
    receipt_status: "valor_diferente", received_amount: 50, received_method: "dinheiro",
    receipt_note: "[fora do raio 1,4 km] entreguei na portaria do prédio",
    stop_order: 6, public_token: tokenAleatorio(16),
    delivered_at: agora, created_at: agora, updated_at: agora,
});

// 7) Rascunho do PDV com token de conferência VÁLIDO (2h), pro /confirmar.
const TOKEN_CONFERENCIA = "smoketestefase4conferenciatoken00";
upsertDelivery(107, {
    shopkeeper_id: LOJA, motoboy_id: null, status: "draft",
    address: "Rua Conferência, 10 - Centro, Uberaba - MG",
    customer_name: "Venda do PDV", customer_phone: "34999990007",
    value: 120, fee: 10, observation: "Pedido do caixa 2",
    lat: perto(500).lat, lng: perto(500).lng, geo_precision: "rua",
    confirm_token: TOKEN_CONFERENCIA,
    confirm_token_expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    public_token: tokenAleatorio(16),
    created_at: agora, updated_at: agora,
});

// 8) Lançamento esperando o "aceito" do motoboy (card de confirmações).
db.prepare("DELETE FROM transactions WHERE id >= 9000").run();
db.prepare(`INSERT INTO transactions
  (id, user_id, creator_id, amount, type, kind, status, description, created_at)
  VALUES (9001, @m, @l, 300, 'debit', 'pagamento', 'pending', 'Paguei via PIX', @t)`)
    .run({ m: MOTOBOY, l: LOJA, t: agora });

// 9) Fechamento do dia esperando resposta do motoboy (card no extrato).
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
db.prepare("DELETE FROM daily_closings WHERE motoboy_id = ? AND day = ?").run(MOTOBOY, hoje);
const colunasFechamento = db.prepare("PRAGMA table_info(daily_closings)").all().map(c => c.name);
console.log("colunas daily_closings:", colunasFechamento.join(", "));

const valores = {
    motoboy_id: MOTOBOY, shopkeeper_id: LOJA, day: hoje,
    deliveries_count: 4, fees_total: 40, cash_total: 92.4,
    net: -52.4, status: "pending", created_at: agora, updated_at: agora,
    balance_before: 0, balance_after: -52.4,
};
const usaveis = Object.keys(valores).filter(k => colunasFechamento.includes(k));
db.prepare(
    `INSERT INTO daily_closings (${usaveis.join(", ")}) VALUES (${usaveis.map(k => "@" + k).join(", ")})`
).run(valores);

// 10) O rastreio público que vamos abrir no navegador.
const rastreio = db.prepare("SELECT public_token FROM deliveries WHERE id = 103").get().public_token;

console.log(JSON.stringify({
    tokenConferencia: TOKEN_CONFERENCIA,
    tokenRastreio: rastreio,
    hoje,
}, null, 2));

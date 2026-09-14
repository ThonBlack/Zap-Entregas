/* eslint-disable */
// Roda TODAS as migrações leves do banco, na ordem certa, e depois a faxina.
//
// Por que existe: a lista ficava escrita à mão dentro do CMD do Dockerfile,
// numa linha só, separada por "&&". Seis scripts estavam lá; outros seis
// existiam na pasta e nunca eram chamados — quem restaurasse um backup antigo
// subia o app sem as colunas do login com Google, do WebAuthn, da conferência
// do PDV... e só descobria quando a tela quebrasse.
//
// Agora a lista mora aqui, com um teste (scripts/test/migrate_all.test.mjs) que
// reclama se alguém criar um `add_*.js` novo e esquecer de acrescentar.
//
// Cada script é repetível (confere antes de alterar), então rodar isto duas
// vezes seguidas não muda nada na segunda.
//
// Rodar:  node scripts/utils/migrate_all.js
//         DATABASE_PATH=./sqlite.db node scripts/utils/migrate_all.js
//
// Se QUALQUER script falhar, este aqui para na hora e sai com código != 0 —
// o `npm start` do container não chega a rodar e o Docker reinicia o container.
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const PASTA = __dirname;

/**
 * A ORDEM IMPORTA:
 *
 * 1. `add_transaction_kind_column.js` vem primeiro porque mexe em `transactions`
 *    e nada depende dele.
 * 2. Tudo que cria coluna/índice em `users` vem ANTES de `make_phone_nullable.js`.
 *    Esse script refaz a tabela `users` inteira (é o único jeito de tirar um
 *    NOT NULL no SQLite) e recria os índices existentes no momento em que roda.
 *    Se `add_google_id_column.js` rodasse depois, o índice único do Google
 *    ainda seria criado — mas na ordem inversa a tabela é refeita duas vezes à
 *    toa. Antes é mais barato e mais previsível.
 * 3. O resto (convite, vínculo com a loja, id externo do PDV, fechamento do dia)
 *    vem depois, em qualquer ordem entre si — são colunas independentes.
 *
 * `opcional: true` = o arquivo pode ainda não existir nesta versão do código
 * (script novo que veio de outro branch). Não existe = pula sem reclamar.
 */
const ORDEM = [
    // --- nivelamento: tudo que foi feito na mão entre o dump de maio e os add_* ---
    // (colunas de recibo/carimbos/public_token em deliveries, email/is_active/
    //  rating/trial/api_key em users, tabelas reviews/app_logs/master_*/push/
    //  password_resets). Os scripts abaixo dependem disto.
    { arquivo: "add_base_schema_catchup.js" },

    // --- transactions ---
    { arquivo: "add_transaction_kind_column.js" },

    // --- users e amigos (antes de refazer a tabela users) ---
    { arquivo: "add_confirm_token_columns.js" },
    { arquivo: "add_geo_precision_column.js" },
    { arquivo: "add_google_id_column.js" },
    { arquivo: "add_shop_location_columns.js" },
    { arquivo: "add_visibility_columns.js" },
    { arquivo: "add_webauthn_table.js" },

    // --- refaz a tabela users pra o telefone virar opcional ---
    { arquivo: "make_phone_nullable.js" },

    // --- colunas independentes ---
    { arquivo: "add_invite_token_columns.js" },
    { arquivo: "add_shopkeeper_id_column.js" },
    { arquivo: "add_external_id_column.js" },
    { arquivo: "add_daily_closings_table.js" },
    { arquivo: "add_charge_mode_column.js" },
    { arquivo: "add_pool_mode_column.js" },
    { arquivo: "add_shop_address_column.js" },
    { arquivo: "add_daily_seq_column.js" },

    // --- índices, trava do crédito e datas num formato só ---
    { arquivo: "add_deliveries_indexes.js" },
    { arquivo: "add_transactions_unique_delivery_index.js" },
    { arquivo: "normalize_timestamps.js" },

    // --- faxina (por último: não é migração, é manutenção) ---
    { arquivo: "prune_app_logs.js" },
];

/**
 * Scripts da pasta que NÃO são migração e por isso não entram na lista.
 * O teste usa esta relação; acrescentar aqui é uma decisão consciente.
 */
const NAO_SAO_MIGRACAO = [];

module.exports = { ORDEM, NAO_SAO_MIGRACAO, PASTA };

function rodar() {
    const banco = process.env.DATABASE_PATH || "/app/sqlite.db";
    console.log(`== migrações leves — banco: ${banco}`);

    let executados = 0;
    let pulados = 0;

    for (const { arquivo, opcional } of ORDEM) {
        const caminho = path.join(PASTA, arquivo);

        if (!fs.existsSync(caminho)) {
            if (opcional) {
                pulados++;
                continue;
            }
            console.error(
                `\n!! MIGRAÇÃO FALTANDO: ${arquivo}\n` +
                `   Está na lista de scripts/utils/migrate_all.js mas não existe na pasta.\n` +
                `   Ou o arquivo foi apagado, ou a lista está errada. Nada foi alterado no banco.\n`
            );
            process.exit(1);
        }

        console.log(`\n-- ${arquivo}`);
        const r = spawnSync(process.execPath, [caminho], {
            stdio: "inherit",
            env: process.env,
        });

        if (r.error) {
            console.error(`\n!! não consegui executar ${arquivo}: ${r.error.message}\n`);
            process.exit(1);
        }
        if (r.status !== 0) {
            console.error(
                `\n!! ${arquivo} FALHOU (código ${r.status}${r.signal ? `, sinal ${r.signal}` : ""}).\n` +
                `   O aplicativo NÃO vai subir: rodar com o banco fora do formato esperado\n` +
                `   é pior do que ficar fora do ar. Veja a mensagem acima, conserte e suba de novo.\n` +
                `   Backup mais recente: /opt/backups/zap-entregas/ (na VPS).\n`
            );
            process.exit(r.status || 1);
        }
        executados++;
    }

    console.log(`\n== pronto: ${executados} script(s) rodaram${pulados ? `, ${pulados} ainda não existem nesta versão` : ""}.`);
}

if (require.main === module) {
    rodar();
}

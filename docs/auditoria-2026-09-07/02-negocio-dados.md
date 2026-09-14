# Regras de negócio, integridade de dados e robustez — achados

## Resumo

A máquina de estados da corrida está bem construída no papel (todo UPDATE de transição repete a condição no `WHERE`), mas o dinheiro em volta dela tem furos: o modal de finalizar aceita valor em branco e grava R$ 0,00 sem gerar débito; o crédito da corrida não tem chave única no banco (só uma checagem lida-e-escreve); três dos quatro modelos de remuneração que a tela oferece pagam R$ 0,00; e o webhook do PDV não tem nenhuma idempotência — o mesmo pedido reenviado vira uma segunda corrida com uma segunda taxa.

Há um problema estrutural de datas: `created_at` guarda `"2026-08-21 16:08:38"` (do `CURRENT_TIMESTAMP`) enquanto o código compara com `toISOString()` (`"...T16:08:38.000Z"`). No SQLite `' ' < 'T'`, então toda comparação do mesmo dia dá falso — isso mata a guarda anti-duplicidade, a contagem do limite de plano no dia 1 do mês e o aviso de corrida nova do motoboy.

No deploy: o `CMD` do Dockerfile roda só 4 dos 10 scripts de migração, e o `docker-compose.yml` do repo não passa as chaves VAPID — quem subir do repo fica sem push e, num banco restaurado de backup, o container sobe e quebra em runtime por coluna faltando.

Escopo desta auditoria: regras de negócio, integridade e robustez. Autorização/IDOR/XSS ficaram com o outro auditor.

---

## Achados

### [P0] Finalizar com "Recebi outro valor" em branco grava R$ 0,00 e não gera o débito do dinheiro
- **Onde:** `src/components/deliveries/CompleteDeliveryModal.tsx:40-46` e `:23`; `src/app/actions/logistics.ts:304-314` e `:388`
- **O que:** No modal, `const amt = Number(amount.replace(",", "."))` com o campo vazio dá `Number("") === 0`, que passa em `Number.isFinite(amt) && amt >= 0`. A validação "Informe o valor recebido." nunca dispara. O servidor aceita `0`, e o débito de "dinheiro do cliente" só é criado se `receivedAmount > 0` (`logistics.ts:388`) — então o dinheiro que o motoboy tem no bolso não entra na carteira dele.
- **Como reproduzir / cenário concreto:** A loja está com `show_order_value = false` (é o padrão do schema, `schema.ts:135`), então o motoboy recebe `value: null` (`src/app/app/page.tsx:38`) → `hasValue` é falso → o modal já abre com **"valor_diferente" selecionado** (`CompleteDeliveryModal.tsx:23`) e o campo de valor vazio. O motoboy toca em "Dinheiro" e em "Confirmar Entrega" sem digitar nada. Resultado: `received_amount = 0`, nenhuma transação de débito, saldo do motoboy sobe pelo crédito da corrida como se ele não tivesse recebido nada.
- **Impacto:** A loja perde o registro do dinheiro que está com o motoboy. Todo acerto de conta fica a menos daquele valor, e não há como perceber pelo extrato (nada aparece).
- **Correção sugerida:** No modal, tratar campo vazio como inválido (`if (!amount.trim())`) e exigir `amt > 0` para `valor_diferente`; no servidor, rejeitar `valor_diferente` com `amount` ausente/zero em vez de aceitar.
- **Confiança:** alta

### [P0] Webhook do PDV sem nenhuma idempotência — o mesmo pedido reenviado vira uma segunda corrida (e uma segunda taxa)
- **Onde:** `src/app/api/integration/delivery/route.ts:137-153` (INSERT direto, sem consulta prévia); não existe `external_id`/`order_id` em `src/db/schema.ts:43-76` nem em nenhum lugar do código (`grep externalId|external_id|orderId` em `src/` = zero resultados)
- **O que:** O `POST /api/integration/delivery` insere uma nova `delivery` a cada chamada. Não há chave do pedido no PDV, nem janela de deduplicação, nem `ON CONFLICT`. Diferente do formulário (`logistics.ts:37-45`), que ao menos tenta uma guarda por endereço, o webhook não tem guarda alguma.
- **Como reproduzir / cenário concreto:** O EpicStore reenvia o pedido #1234 (retry por timeout, ou o operador clicando "enviar" de novo com `force`). Chegam dois `draft` idênticos. Se o caixa/lojista liberar os dois (a tela `/confirmar/<token>` mostra um por vez e cada um tem seu próprio token válido), viram duas corridas `pending`, dois motoboys aceitam, e a loja paga duas taxas por uma entrega só.
- **Impacto:** Pagamento em duplicidade ao motoboy e cliente recebendo duas visitas. Quanto maior o volume do PDV, mais provável.
- **Correção sugerida:** Adicionar coluna `external_id` em `deliveries` com índice único por `(shopkeeper_id, external_id)`, aceitar o identificador do pedido no corpo e, quando ele já existir, devolver 200 com o `deliveryId`/`confirmUrl` da corrida original em vez de criar outra.
- **Confiança:** alta (a ausência de idempotência é certa; a frequência do reenvio depende do EpicStore)

### [P1] Crédito e débito da corrida sem chave única no banco — duas finalizações simultâneas creditam duas vezes
- **Onde:** `src/app/actions/logistics.ts:365-399`; DDL de `transactions` (só há `transactions_delivery_idx`, índice **não** único — ver `scripts/utils/add_transaction_kind_column.js:29-30`)
- **O que:** A idempotência é feita por leitura seguida de escrita: lê as transações da corrida (`:365`), decide `hasCredit`/`hasDebit` (`:369-370`) e só então insere (`:374`, `:389`). Entre a leitura e a inserção há um `await`, então duas execuções concorrentes leem "nenhum crédito" e ambas inserem. Não existe restrição no banco para barrar.
- **Como reproduzir / cenário concreto:** O motoboy toca em "Confirmar Entrega", a rede engasga, ele reabre o app em outra aba/aparelho e confirma de novo antes da primeira requisição terminar. Resultado: duas linhas `kind='corrida'` com o mesmo `related_delivery_id` e o saldo do motoboy com a taxa dobrada.
- **Impacto:** Saldo inflado sem rastro óbvio (as duas linhas parecem legítimas no extrato). A guarda `disabled={loading}` do modal (`CompleteDeliveryModal.tsx:155`) só protege cliques no mesmo aparelho.
- **Correção sugerida:** Criar índice único `(related_delivery_id, kind)` em `transactions` (após limpar eventuais duplicatas) e envolver leitura+inserção+UPDATE do status numa transação do SQLite (`db.transaction`), tratando a violação do índice como "já creditado".
- **Confiança:** alta quanto à falta de proteção no banco; média quanto à facilidade de disparar na prática

### [P1] Modelos de remuneração "Por KM", "Diária" e a parte por km do "Híbrido" pagam R$ 0,00
- **Onde:** `src/app/actions/logistics.ts:353-363`; `src/app/api/integration/delivery/route.ts:126-135`; `src/components/admin/SettingsForm.tsx:41-43` (a tela oferece os quatro modelos); `valuePerKm`, `dailyvalue` e `guaranteedMinimum` **não são lidos em lugar nenhum** fora do formulário de configuração (grep confirma)
- **O que:** Tanto ao finalizar quanto ao criar a corrida pelo PDV, a taxa só é calculada quando `remunerationModel` é `"fixed"` ou `"hybrid"`, e sempre usando `fixedValue`. Se a loja escolheu "Por KM" ou "Diária", `fee` fica 0 e o `if (!hasCredit && fee > 0 ...)` nunca cria o crédito — o motoboy não ganha nada e ninguém avisa.
- **Como reproduzir / cenário concreto:** Lojista entra em Configurações, escolhe "Por KM" e põe R$ 2,00/km (a tela mostra o campo e salva). Toda corrida do mês fecha com `fee = 0` e nenhuma transação de corrida. O extrato do motoboy fica zerado.
- **Impacto:** Motoboy trabalha o mês inteiro sem crédito na carteira. Também vale para o "mínimo garantido", que é salvo e nunca aplicado.
- **Correção sugerida:** Ou implementar o cálculo por km (distância loja→entrega já existe em `routeUtils.distanceKm`) e diária/mínimo garantido, ou remover as opções não implementadas da tela e deixar só "Fixo".
- **Confiança:** alta

### [P1] Valor com separador de milhar vira centavos — quatro conversores de dinheiro diferentes, e o correto (`lib/money.ts`) só é usado no webhook
- **Onde:** `src/app/actions/finance.ts:34`; `src/app/actions/logistics.ts:32`; `src/app/actions/deliveries.ts:12-15`; `src/app/actions/drafts.ts:72-75`; `src/app/actions/routes.ts:57-60`; `src/app/actions/financial-records.ts:63`; `src/components/deliveries/CompleteDeliveryModal.tsx:40` — todos fazem `replace(",", ".")` e `parseFloat`, enquanto `src/lib/money.ts:20-27` já trata milhar corretamente
- **O que:** `"1.234,56".replace(",", ".")` vira `"1.234.56"`, e `parseFloat("1.234.56")` devolve `1.234`. O valor é aceito sem erro.
- **Como reproduzir / cenário concreto:** Lojista faz o acerto do mês pelo botão "Acertar", mas digita o valor à mão como está acostumado: `1.850,00`. É gravada uma transação de R$ 1,85. O saldo do motoboy fica devendo R$ 1.848,15 e o extrato mostra "Paguei o motoboy — R$ 1,85".
- **Impacto:** Erro de dinheiro silencioso em toda entrada manual (acerto, bônus, desconto, valor do pedido, taxa da corrida, contas a pagar).
- **Correção sugerida:** Trocar as sete implementações locais por `parseMoney` de `src/lib/money.ts` e devolver erro explícito quando ele retornar `null`, em vez de cair em 0.
- **Confiança:** alta

### [P1] Conferência do PDV sempre grava `geo_precision = "exata"`, mesmo com o pino no meio da loja
- **Onde:** `src/components/deliveries/DraftConfirmForm.tsx:67-72` e `:128-131`; `src/app/actions/drafts.ts:84-86` e `:122`
- **O que:** Quando o geocode falha, o formulário inicializa o pino nas coordenadas da loja — ou, se a loja não tem coordenada, no ponto fixo `-19.7472, -47.9381` (`DraftConfirmForm.tsx:67-68`). O submit sempre envia `lat`/`lng` desse estado (`:128-129`), então em `confirmDraftAction` o `pinValid` é sempre verdadeiro (`drafts.ts:86`) e o registro sai com `geoPrecision: "exata"` (`drafts.ts:122`), independentemente de a pessoa ter encostado no pino. O campo `pinTouched` é enviado (`:131`) mas o `confirmDraftAction` nunca o lê — só `updatePendingDeliveryAction` usa (`deliveries.ts:65`).
- **Como reproduzir / cenário concreto:** Chega um endereço que o Google e o OSM não acham. A tela avisa "Não achei esse endereço no mapa. Arraste o pino...". O caixa, com fila no balcão, clica direto em "Liberar". A corrida fica com as coordenadas **da loja** carimbadas como "exata". Depois, o motoboy na casa do cliente vê o botão "Entregue" bloqueado ("Você está a 3,4 km do local") porque a cerca de 200 m (`PendingDeliveriesForm.tsx:254-257`) está medindo em relação à loja.
- **Impacto:** Motoboy não consegue fechar a entrega no local; a tela do lojista deixa de avisar que o ponto é chute; o mapa de rastreio mostra o cliente na loja.
- **Correção sugerida:** Em `confirmDraftAction`, ler `pinTouched` como o `updatePendingDeliveryAction` já faz e só gravar `"exata"` quando o pino foi movido; caso contrário preservar a precisão do geocode (ou `null`). No formulário, exigir que o pino seja tocado quando `hadNoPin` for verdadeiro.
- **Confiança:** alta

### [P1] O `CMD` do Dockerfile roda 4 dos 10 scripts de migração — banco restaurado sobe e quebra em runtime
- **Onde:** `Dockerfile:24` (roda `add_transaction_kind_column`, `make_phone_nullable`, `add_invite_token_columns`, `add_shopkeeper_id_column`); `scripts/utils/` tem também `add_confirm_token_columns.js`, `add_geo_precision_column.js`, `add_google_id_column.js`, `add_shop_location_columns.js`, `add_visibility_columns.js`, `add_webauthn_table.js`
- **O que:** Seis migrações ficaram de fora do start. As colunas que elas criam são usadas em consulta e escrita: `deliveries.confirm_token`/`confirm_token_expires_at` (webhook do PDV, `integration/delivery/route.ts:151-152`), `deliveries.geo_precision`, `users.google_id` (login Google), `shop_settings.shop_lat/shop_lng/default_city/default_state` (geocode) e as colunas de visibilidade, além da tabela `webauthn_credentials` (consultada no `/app`, `src/app/app/page.tsx:200-203`).
- **Como reproduzir / cenário concreto:** Restaurar o `sqlite.db` de um backup anterior aos ALTERs feitos à mão e subir o container. As quatro migrações do `CMD` passam, o `npm start` sobe, o Nginx responde — e a primeira abertura de `/app` estoura `SQLITE_ERROR: no such column: webauthn_credentials`/`shop_lat`. O app fica no ar e quebrado.
- **Impacto:** Restauração de backup ou provisionamento de instância nova entrega um sistema que parece ok e falha na primeira tela. Como o `&&` encadeia, se qualquer script falhar o container também não sobe — o que é o comportamento desejado, mas hoje ele não chega a checar as colunas que faltam.
- **Correção sugerida:** Incluir os seis scripts no `CMD` na ordem correta (todos já são idempotentes: checam `PRAGMA table_info` antes do ALTER) ou trocar por um único `scripts/utils/migrate_all.js` que os chame em sequência.
- **Confiança:** alta

### [P1] `docker-compose.yml` do repo não passa VAPID nem as envs do iframe/TWA — push vira no-op silencioso
- **Onde:** `docker-compose.yml:12-40` (lista completa das envs); `src/lib/push.ts:9-14` (`if (!pub || !priv) return false; // sem chaves, push vira no-op silencioso`); `src/proxy.ts:18` (`PDV_FRAME_ANCESTORS`); `src/app/api/assetlinks/route.ts:14-15` (`ANDROID_PACKAGE_NAME`, `ANDROID_CERT_FINGERPRINTS`)
- **O que:** O compose versionado não injeta `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PDV_FRAME_ANCESTORS`, `ANDROID_PACKAGE_NAME` nem `ANDROID_CERT_FINGERPRINTS`. Essas variáveis existem no `.env.local` (que fica na máquina do Thon e não é copiado pro container). Sem VAPID, `ensureConfigured()` retorna `false` e **todos** os `pushToUser`/`pushToMotoboys`/`pushToDraftReviewers` não fazem nada e não registram erro nenhum.
- **Como reproduzir / cenário concreto:** `docker compose up -d --force-recreate` na VPS usando o arquivo do repo. Corrida nova entra, ninguém recebe notificação, o app continua "funcionando", e o único aviso restante é o polling de 10 s — que também está quebrado (achado abaixo). Sem `PDV_FRAME_ANCESTORS`, a tela `/confirmar/<token>` para de abrir no iframe do PDV; sem `ANDROID_CERT_FINGERPRINTS`, o TWA passa a mostrar a barra do Chrome.
- **Impacto:** Corridas paradas sem ninguém saber. Como já roda em produção, é provável que o compose da VPS tenha sido editado à mão — o que significa que o arquivo do repo está desatualizado e qualquer redeploy "limpo" derruba os três recursos.
- **Correção sugerida:** Adicionar as seis variáveis ao `docker-compose.yml` (com `${VAR:-}`), e fazer o `push.ts` logar um aviso uma vez quando as chaves faltarem, em vez de virar no-op mudo.
- **Confiança:** alta sobre o conteúdo do arquivo; média sobre o estado atual da VPS (não foi possível ler o compose de lá)

### [P1] Mistura de formatos em `created_at` quebra três regras: guarda anti-duplicidade, limite de plano e aviso de corrida nova
- **Onde:** origem do problema: `src/db/schema.ts:74` (`CURRENT_TIMESTAMP` grava `"2026-08-21 16:08:38"`) contra `toISOString()` (`"2026-08-21T16:08:38.000Z"`). Comparações afetadas: `src/app/actions/logistics.ts:41`, `src/app/actions/routes.ts:37`, `src/lib/planLimits.ts:50`, `src/app/api/notifications/check/route.ts:24`, `src/app/actions/finance.ts:125-126`
- **O que:** No SQLite a comparação é textual e `' ' (0x20) < 'T' (0x54)`. Verificado com o próprio better-sqlite3: `'2026-08-21 16:08:38' > '2026-08-21T15:00:00.000Z'` devolve **0 (falso)**. Ou seja, comparar `created_at` com um `toISOString()` do mesmo dia sempre dá falso. Consequências concretas:
  1. `logistics.ts:37-45` e `routes.ts:33-42` — a consulta "já existe entrega igual nos últimos 5 min / 60 s" **nunca** acha nada. A trava contra duplo envio está morta.
  2. `planLimits.ts:46-51` — `gte(created_at, primeiroDiaDoMês.toISOString())` exclui todas as corridas criadas no **dia 1** do mês. O limite do plano conta a menos.
  3. `notifications/check/route.ts:24` — `gt(created_at, lastCheck)` nunca é verdadeiro para corridas do mesmo dia, então o aviso "Nova Corrida Disponível" do polling nunca dispara depois da primeira checagem.
  4. `finance.ts:125-126` — o gráfico financeiro perde os lançamentos do dia 1 do mês.
- **Como reproduzir / cenário concreto:** Lojista clica duas vezes em "Adicionar entrega" com o mesmo endereço. A mensagem "Entrega já adicionada recentemente." nunca aparece e nascem duas corridas iguais — que viram duas taxas pagas.
- **Impacto:** Corridas duplicadas por duplo clique, limite de plano furado e o fallback de aviso do motoboy inoperante.
- **Correção sugerida:** Padronizar `created_at`: ou gravar sempre ISO no código (como já é feito com `updated_at`), ou comparar sempre via `datetime(created_at)` no SQL (o `/app/page.tsx:66-81` já faz certo assim). Fazer um `UPDATE` único normalizando as linhas antigas.
- **Confiança:** alta (comportamento verificado rodando a comparação no SQLite)

### [P1] O geocode roda dentro da requisição do PDV e pode segurar a resposta por vários segundos
- **Onde:** `src/app/api/integration/delivery/route.ts:112-118` (`await geocodeAddress` antes do INSERT); `src/lib/geocode.ts:50-56` (`respeitarLimiteOsm`, espera 1100 ms) e `:108-147` (até 3 tentativas Nominatim + ViaCEP + bairro + cidade)
- **O que:** Quando o Google não está configurado, ou recusa (`REQUEST_DENIED`/`OVER_QUERY_LIMIT`, tratado em `geocode.ts:184-187` devolvendo `null`), a cascata cai no Nominatim, que é serializado por um `sleep` de 1,1 s por chamada. O pior caso encadeia 5 chamadas → ~5,5 s só de espera, mais a latência da rede, tudo antes de responder ao PDV.
- **Como reproduzir / cenário concreto:** Cota diária do Google (300/dia) estoura às 18h. O PDV manda a próxima venda; o `POST` fica ~6 s aberto. Se o EpicStore tiver timeout menor, ele considera falha e **reenvia** — e, como não há idempotência (achado P0), cria uma corrida a mais.
- **Impacto:** Caixa travado esperando a janelinha, e duplicação de corrida no reenvio.
- **Correção sugerida:** Responder ao PDV imediatamente com a corrida em `draft` sem coordenada e fazer o geocode em segundo plano (ou só na abertura da tela de conferência, que já sabe recalcular). Alternativamente, aplicar um teto de tempo (`AbortSignal.timeout`) ao bloco de geocode.
- **Confiança:** alta

---

### [P2] `acceptDeliveryAction` não confere quantas linhas mudaram — quem perdeu a corrida vê "aceita"
- **Onde:** `src/app/actions/logistics.ts:202-228`
- **O que:** O `UPDATE` tem a condição certa (`eq(status,"pending")` em `:216`), o que garante que só um motoboy realmente ganha a corrida. Mas o retorno do UPDATE é descartado e a ação sempre devolve `{ success: true }` (`:228`). O cliente então recarrega a página (`PendingDeliveriesForm.tsx:125`).
- **Como reproduzir / cenário concreto:** Dois motoboys tocam em "Aceitar" com poucos milissegundos de diferença. Ambos os SELECTs (`:202`) veem `pending`; o segundo UPDATE afeta 0 linhas. O segundo motoboy vê a tela recarregar sem erro, acha que pegou a corrida e sai da loja de mãos vazias.
- **Impacto:** Confusão operacional e desconfiança no app. O dado no banco fica correto.
- **Correção sugerida:** Usar `.returning()` no UPDATE e devolver "Outro motoboy pegou essa corrida" quando vier vazio. Vale também incluir `isNull(motoboyId)` no `WHERE`, como já é feito em `deliveries.ts:103`.
- **Confiança:** alta

### [P2] Excluir corrida já aceita não tem trava de status, não avisa o motoboy e não existe cancelamento com estorno
- **Onde:** `src/app/actions/logistics.ts:168-192`; `src/app/actions/drafts.ts:144-165` (único caminho que grava `status="canceled"`, e só para `draft`); FKs de `transactions.related_delivery_id` e `reviews.delivery_id` com `ON DELETE no action` (DDL do `sqlite.db`)
- **O que:** `deleteDeliveryAction` apaga a linha sem checar o status: uma corrida `assigned` ou `picked_up` some do app do motoboy no meio da rua, sem notificação. Se a corrida já tiver transações (isto é, já foi entregue), o `DELETE` estoura por chave estrangeira e o lojista recebe a mensagem genérica "Erro ao excluir. Verifique se existem registros associados." (`:190`). Não existe nenhuma ação que cancele uma corrida aceita com estorno da carteira.
- **Como reproduzir / cenário concreto:** Cliente desiste depois que o motoboy já saiu. O lojista clica na lixeira: a corrida evapora, o motoboy continua indo entregar e, se ele já tinha finalizado, o clique falha com um erro sem explicação.
- **Impacto:** Motoboy perde a corrida do painel sem saber por quê; corridas finalizadas ficam impossíveis de cancelar pela interface.
- **Correção sugerida:** Restringir o `DELETE` a `draft`/`pending` sem motoboy; para os demais, criar um `cancelDeliveryAction` que grava `status="canceled"`, notifica o motoboy e lança o estorno (`ajuste` no sinal contrário) quando já houver crédito.
- **Confiança:** alta

### [P2] Limite de plano não é aplicado no webhook do PDV e é checado uma única vez para uma rota inteira
- **Onde:** `src/app/api/integration/delivery/route.ts` (nenhuma chamada a `canCreateDelivery` no arquivo); `src/app/actions/routes.ts:27-31` (checagem antes do laço); `src/lib/planLimits.ts:57-77`
- **O que:** O caminho que mais gera corridas — o PDV — não passa por nenhuma verificação de plano. E em `createRouteAction` a verificação é feita uma vez, independentemente de quantos endereços vêm no formulário.
- **Como reproduzir / cenário concreto:** Loja no plano Free (30 corridas/mês, `plans.max_deliveries = 30`) com 29 corridas feitas. Ela cria uma rota com 20 endereços: a checagem passa (`remaining = 1`) e os 20 são inseridos de uma vez (`routes.ts:113`). Pelo PDV, o limite simplesmente nunca é consultado.
- **Impacto:** O limite comercial do plano não segura nada na prática. Somado ao bug de data acima (dia 1 não conta), a contagem também é menor que a real.
- **Correção sugerida:** Chamar `canCreateDelivery` no webhook (devolvendo 402/403 com mensagem clara pro PDV) e, na rota, comparar `remaining` com `addresses.length`.
- **Confiança:** alta

### [P2] GPS do motoboy escreve no SQLite a cada fix, sem intervalo mínimo
- **Onde:** `src/components/map/LocationTracker.tsx:17-32`; `src/app/actions/tracking.ts:8-33`
- **O que:** `watchPosition` com `enableHighAccuracy: true` e `maximumAge: 0` dispara a cada leitura nova do GPS (no Android, pode ser a cada 1 s em movimento) e cada leitura vira uma server action com um `UPDATE users`. Não há throttle, nem filtro de "só grava se moveu mais de X metros", nem `debounce`.
- **Como reproduzir / cenário concreto:** Motoboy de plano pago com o app aberto durante 1 h de rota gera na ordem de milhares de requisições e milhares de escritas no SQLite (que está em `journal_mode=delete`, sem WAL — achado abaixo), competindo com as leituras das telas.
- **Impacto:** Carga desproporcional no servidor e na bateria do celular. A tabela não cresce (só sobrescreve `users.current_lat/lng`), então não há inchaço de dados — o problema é volume de escrita.
- **Correção sugerida:** Só enviar quando passaram ≥ 15 s **e** o motoboy andou ≥ 30 m desde o último envio; `enableHighAccuracy` pode ficar, o que muda é a frequência do POST.
- **Confiança:** alta

### [P2] Primeira checagem de notificação usa `lastCheck=0` e joga um monte de aviso antigo na tela
- **Onde:** `src/components/shared/usePushNotifications.ts:47` (`ultimaChecagem = useRef(0)`) e `:126`; `src/app/api/notifications/check/route.ts:18` e `:21-46`
- **O que:** O primeiro `fetch` manda `lastCheck=0`, que vira `new Date(0)` = 01/01/1970. A consulta então casa com **todas** as corridas `pending` do banco (até o `limit: 10`), e o motoboy recebe até 11 notificações de uma vez (10 corridas + o resumo "Várias Corridas Disponíveis").
- **Como reproduzir / cenário concreto:** O motoboy abre o app com permissão de notificação concedida. Dez segundos depois, o celular vibra e mostra uma pilha de avisos de corridas que estão paradas há dias (as 3 `pending` antigas do banco local, por exemplo). Depois disso, por causa do bug de formato de data, nunca mais avisa nada.
- **Impacto:** Experiência ruim na abertura e nenhum aviso de verdade depois. O motoboy tende a desligar a permissão.
- **Correção sugerida:** Inicializar `ultimaChecagem` com `Date.now()` no primeiro efeito (ou ignorar no servidor um `lastCheck` menor que, digamos, 10 minutos atrás) e corrigir a comparação de data.
- **Confiança:** alta

### [P2] Cache do geocode cresce sem limite, guarda falhas por 24 h, e o throttle do OSM não serializa de fato
- **Onde:** `src/lib/geocode.ts:59-83` e `:50-56`
- **O que:** Três coisas no mesmo arquivo: (a) o `Map` de cache nunca é podado — entradas vencidas continuam ocupando memória e ele cresce com cada endereço novo, para sempre; (b) `cache.set(chave, { valor: resultado ... })` guarda também o `null` (`:82`), então um endereço que falhou porque o Nominatim estava fora do ar fica "sem coordenada" por 24 h mesmo depois que o serviço volta; (c) `respeitarLimiteOsm` lê `ultimaChamadaOsm` antes de qualquer `await` e só o atualiza depois — duas chamadas concorrentes calculam a mesma espera e disparam juntas, furando o limite de 1 req/s do Nominatim.
- **Como reproduzir / cenário concreto:** O Nominatim devolve 503 por 5 minutos. Todos os endereços tentados nesse período ficam gravados como "não achei" e continuam sem pino até o dia seguinte, mesmo reconferindo pela tela.
- **Impacto:** Memória crescente no processo Node (lento, mas contínuo) e endereços que ficam sem pino por um dia inteiro sem motivo.
- **Correção sugerida:** Não cachear `null` (ou cachear por poucos minutos), limitar o `Map` a N entradas com descarte do mais antigo, e transformar o throttle numa fila encadeada (`ultimaPromessa = ultimaPromessa.then(...)`).
- **Confiança:** alta

### [P2] Faltam índices nas consultas quentes de `deliveries`, e o histórico não tem paginação
- **Onde:** DDL do `sqlite.db` — os únicos índices de `deliveries` são `deliveries_public_token_unique` e `deliveries_confirm_token_unique`. Consultas sem índice: `src/app/app/page.tsx:227-233` (`status` + `shopkeeper_id`), `:255-266` (`status` + `motoboy_id`), `:291-297`, `src/app/deliveries/history/page.tsx:23-48`, `src/app/api/notifications/check/route.ts:21-105`
- **O que:** Toda listagem de corrida é varredura completa da tabela. O `/deliveries/history` traz **todas** as entregas concluídas de uma vez, sem `limit`, e renderiza a lista inteira. O polling de 10 s por motoboy repete essas varreduras.
- **Como reproduzir / cenário concreto:** Com um ano de operação (algo como 15–20 mil corridas), o histórico do lojista passa a carregar a tabela inteira em cada abertura e o polling faz 6 varreduras por minuto por motoboy conectado.
- **Impacto:** Hoje, com 11 linhas, não dói. Vira problema de resposta conforme o volume cresce — e o SQLite sem WAL faz leitura longa bloquear escrita.
- **Correção sugerida:** Criar `idx_deliveries_status`, `idx_deliveries_motoboy_status(motoboy_id, status)` e `idx_deliveries_shop_status(shopkeeper_id, status)` num script de migração idempotente; paginar `/deliveries/history` (30 por página).
- **Confiança:** alta

### [P2] Banco sem WAL — e o bind-mount de arquivo único torna ligar o WAL arriscado do jeito que está hoje
- **Onde:** `src/db/index.ts:6-14` (só liga `foreign_keys`); `docker-compose.yml:10` (`- ./sqlite.db:/app/sqlite.db`)
- **O que:** Verificado no banco: `journal_mode = delete`. O `busy_timeout` **está** ok (5000 ms, padrão do better-sqlite3 12.5.0), então não há risco imediato de `SQLITE_BUSY`. Mas com journal `delete` qualquer escrita bloqueia leituras concorrentes, o que casa mal com o polling de 10 s e com o GPS a cada fix. O detalhe importante: o volume monta o **arquivo** `sqlite.db`, não o diretório — se o WAL for ligado assim, os arquivos `sqlite.db-wal` e `sqlite.db-shm` nascem dentro do container e **não são persistidos**; ao recriar o container, transações ainda não integradas ao arquivo principal se perdem.
- **Como reproduzir / cenário concreto:** Ligar `PRAGMA journal_mode=WAL` no `db/index.ts` sem mexer no compose e depois rodar `docker compose down && up`. O `-wal` fica no sistema de arquivos descartado do container.
- **Impacto:** Sem WAL, contenção de leitura/escrita que piora com o volume. Com WAL mal configurado, risco de perder as últimas transações num restart.
- **Correção sugerida:** Mover o banco para um diretório montado (`./data:/app/data`, `DATABASE_PATH=/app/data/sqlite.db`) e só então ligar `journal_mode=WAL` e `synchronous=NORMAL` no `db/index.ts`.
- **Confiança:** alta

### [P2] Motoboy reordena as corridas de outras lojas ao gerar rota
- **Onde:** `src/app/actions/logistics.ts:104-108` e `:152-154`
- **O que:** O filtro de visibilidade permite ao motoboy incluir qualquer corrida com `status === "pending"` (`:107`), inclusive de outra loja, e em seguida o `stopOrder` de todas elas é reescrito (`:152-154`). O mesmo trecho também dispara `UPDATE` de `lat`/`lng` em corridas de terceiros (`:133`).
- **Como reproduzir / cenário concreto:** Com dois lojistas no sistema, o motoboy da loja A marca corridas das duas lojas e clica em "Gerar Rota". A ordem das paradas que o lojista B vê no painel dele é reescrita por alguém de fora.
- **Impacto:** Ordem de entrega de outra loja bagunçada sem rastro. Consequência da dívida já conhecida ("motoboy vê pending de todas as lojas"), mas aqui vira **escrita**, não só leitura.
- **Correção sugerida:** No `visible`, restringir o motoboy a `d.motoboyId === me.id` (as pendentes ele nem precisa reordenar) ou, no mínimo, só escrever `stopOrder` nas corridas que já são dele.
- **Confiança:** alta

### [P2] Recibo errado é irreversível pela interface
- **Onde:** `src/app/actions/logistics.ts:337-347` (finalizar de novo devolve `alreadyDelivered: true` e não altera nada) e `:401-412`
- **O que:** Depois que a corrida vira `delivered`, não existe nenhuma ação que corrija `receipt_status`, `received_amount` ou `received_method`, nem que refaça o débito. A idempotência por `hasDebit` (`:388`) impede até a criação posterior do débito que faltou.
- **Como reproduzir / cenário concreto:** O motoboy marca "Não recebi" por engano quando na verdade recebeu R$ 150 em dinheiro. Não há tela pra corrigir. A conciliação só fecha se o lojista lançar um "Cobrar do motoboy" manual — que entra como `ajuste`, não como `dinheiro`, e a corrida continua registrada como não recebida.
- **Impacto:** O relatório da corrida fica permanentemente errado e a natureza do lançamento no extrato não bate com o que aconteceu.
- **Correção sugerida:** Criar uma ação de "corrigir recebimento" para lojista/admin que atualize os campos `receipt_*` e ajuste (ou crie/estorne) a transação `dinheiro` correspondente, registrando quem corrigiu.
- **Confiança:** alta

### [P2] Rascunho não expira, não é limpo e o PDV nunca fica sabendo que a corrida foi cancelada
- **Onde:** `src/lib/trackingToken.ts:19-23` (token de 2 h); `src/app/actions/drafts.ts:30-60` (o caminho logado **não** verifica expiração) e `:144-165`; nenhum `fetch` de callback existe no projeto
- **O que:** O token do PDV expira em 2 h, mas o `draft` em si nunca expira: ele fica na `DraftsBanner` (`src/app/app/page.tsx:217-225`) para sempre — o banco local já tem 6 rascunhos de 20–21/08 acumulados. E quando o rascunho é cancelado (`cancelDraftAction`), a única sinalização é um `postMessage` para a janela do PDV (`DraftConfirmForm.tsx:88-89`); se a janela foi fechada, o EpicStore continua achando que a entrega foi registrada.
- **Como reproduzir / cenário concreto:** Venda cancelada no PDV às 14h; o caixa fecha a janelinha sem conferir. Às 16h o token vence. O rascunho fica no painel do lojista até alguém cancelar na mão, e o EpicStore nunca é avisado.
- **Impacto:** Painel do lojista poluído com rascunhos fantasmas e divergência entre o que o PDV acha e o que existe no Zap.
- **Correção sugerida:** Expirar rascunhos automaticamente (ex.: cancelar sozinho após 24 h, com aviso na tela) e, se o EpicStore aceitar, chamar um callback de status na confirmação/cancelamento em vez de depender do `postMessage`.
- **Confiança:** alta

### [P2] Acerto de saldo sem trava de reenvio
- **Onde:** `src/app/actions/finance.ts:14-61`; `src/app/motoboys/[id]/financeiro/page.tsx:30-34` (o link "Acertar" carrega o valor na URL)
- **O que:** `createTransactionAction` não tem nenhuma chave de idempotência nem checagem de lançamento igual recente. O botão do formulário fica desabilitado durante o envio (`ManualEntryForm.tsx:124`), mas o link "Acertar R$ X" é um GET com o valor na query — voltar no navegador reabre o formulário já preenchido.
- **Como reproduzir / cenário concreto:** Lojista clica em "Acertar R$ 850,00", salva, é redirecionado, acha que não salvou, aperta "voltar" e salva de novo. Ficam dois pagamentos de R$ 850 e o motoboy passa a ter R$ 850 de crédito indevido.
- **Impacto:** Pagamento em duplicidade na carteira, do valor inteiro do acerto.
- **Correção sugerida:** Rejeitar lançamento idêntico (mesmo motoboy, mesmo valor, mesmo `entry`) nos últimos ~60 s, ou embutir um token de uso único no formulário.
- **Confiança:** alta

### [P2] Nenhum log de servidor chega em `app_logs` — em produção o `console.error` se perde
- **Onde:** `src/lib/logger.ts:14-108` (a classe é toda de navegador, `fetch("/api/logs")`); `src/app/api/logs/route.ts:34` e `src/app/api/auth/google/callback/route.ts:81` são os **únicos** dois `insert(appLogs)` do projeto; os erros de negócio saem em `console.error` (`logistics.ts:189`, `:230`, `:273`, `:442`; `integration/delivery/route.ts:120`, `:177`; `geocode.ts:185`, `:207`, `:269`)
- **O que:** Toda falha de servidor — geocode que quebrou, `[COMPLETE ERROR]`, erro interno do webhook — vai só pro stdout do container. A tabela `app_logs` existe e tem um `GET` de admin (`api/logs/route.ts:53-72`), mas ninguém escreve nela do lado do servidor. O `unhandled_error` capturado pelo `AppLogger` (`logger.ts:90-103`) só pega erro de JavaScript no navegador, e nas páginas públicas o `POST /api/logs` volta 401 (dívida já conhecida).
- **Como reproduzir / cenário concreto:** Uma finalização de entrega falha para o motoboy ("Erro ao finalizar"). O Thon abre o painel de logs e não encontra nada; precisa de `docker logs` e torcer para a linha não ter rolado.
- **Impacto:** Depuração cega justamente nos caminhos que mexem com dinheiro.
- **Correção sugerida:** Criar um `logServerError(event, err, meta)` que grava em `app_logs` e chamá-lo nos `catch` de `logistics.ts`, do webhook e do geocode (mantendo o `console.error`).
- **Confiança:** alta

---

### [P3] Dinheiro guardado como `REAL` (float) em vez de centavos inteiros
- **Onde:** `src/db/schema.ts:55-56` (`value`, `fee`), `:93` (`transactions.amount`), `:115` (`financial_records.amount`); soma no SQL em `src/lib/wallet.ts:16-23` e acumulação em JS em `:120-126`
- **O que:** Saldo e totais são somas de ponto flutuante. Não vi erro em produção (o banco local tem só 3 lançamentos) e a exibição passa por `toLocaleString`/`toFixed(2)`, que arredonda. O risco é o resíduo aparecer numa comparação (`saldo > 0` com um saldo "zerado" que na verdade é `0.000000001`, deixando o botão "Acertar R$ 0,00" ativo em `motoboys/[id]/financeiro/page.tsx:30`).
- **Impacto:** Cosmético hoje; vira confusão com muitos lançamentos.
- **Correção sugerida:** Ou migrar para inteiro em centavos, ou arredondar o saldo (`Math.round(x*100)/100`) na saída de `getBalance`/`getStatement`.
- **Confiança:** média (não reproduzido; risco teórico bem conhecido de float)

### [P3] Ordenação do histórico erra entre linhas do mesmo dia por causa dos formatos mistos de `updated_at`
- **Onde:** `src/app/deliveries/history/page.tsx:26`, `:37`, `:48` (`orderBy(desc(deliveries.updatedAt))`); formatos mistos confirmados no `sqlite.db` (id 11 = `"2026-08-21 16:08:38"`, id 10 = `"2026-08-21T16:08:21.691Z"`)
- **O que:** Linhas gravadas pelo padrão do banco e linhas gravadas por `toISOString()` convivem na mesma coluna. Como o texto é comparado caractere a caractere, entre registros do mesmo dia as ISO caem sempre depois das outras, independentemente da hora.
- **Impacto:** Histórico fora de ordem em alguns pares de linhas do mesmo dia.
- **Correção sugerida:** Mesma normalização do achado P1 de datas; ordenar por `datetime(updated_at)` enquanto isso.
- **Confiança:** alta

### [P3] Trial só expira quando alguém abre `/app`, e não bloqueia nada além do limite de corridas
- **Onde:** `src/app/app/page.tsx:168-183`
- **O que:** A verificação de fim de trial é feita no render do painel. Uma conta em trial vencido que só use o PDV (webhook) nunca é rebaixada, porque nada em `api/integration/delivery` olha `subscriptionStatus`/`trialEndsAt`. E o rebaixamento é para `free`, que continua permitindo 30 corridas/mês — `subscription_status: "inactive"` não é consultado em nenhum lugar do código.
- **Impacto:** O trial não tem consequência prática de cobrança.
- **Correção sugerida:** Mover a expiração para um ponto único no servidor (ex.: dentro de `requireUser`) e decidir explicitamente o que `subscriptionStatus: "inactive"` bloqueia.
- **Confiança:** alta

### [P3] `app_logs` cresce sem poda
- **Onde:** `src/app/api/logs/route.ts:34-44`; nenhum `DELETE` de `app_logs` no projeto
- **O que:** O `LoggerInitializer` grava `session_start`/`session_end` a cada abertura de sessão, com `stack` e `metadata` de até 4 KB. Nada apaga log antigo.
- **Impacto:** Crescimento lento do arquivo do SQLite (que é o mesmo dos dados de negócio).
- **Correção sugerida:** Apagar `app_logs` com mais de 30–60 dias num script rodado no start do container.
- **Confiança:** alta

---

## Coisas verificadas e OK (lista curta — pra não re-auditar)

- **Transições de estado barradas no servidor**: `confirmDraftAction` e `cancelDraftAction` repetem `status='draft'` no `WHERE` (`drafts.ts:126`, `:157`) e checam o resultado; `updatePendingDeliveryAction` repete `status='pending' AND motoboy_id IS NULL` (`deliveries.ts:100-104`) e devolve erro quando nada muda; `pickupDeliveryAction` só aceita `assigned` do próprio motoboy (`logistics.ts:244-249`); `completeDeliveryAction` restringe os status abertos por papel (`logistics.ts:324-332`).
- **Editar corrida depois de aceita**: bloqueado em dois pontos, no `SELECT` (`deliveries.ts:40-42`) e no `WHERE` do `UPDATE`. Correto.
- **Sinal de cada `kind`**: a tabela `MANUAL_ENTRY_OPTIONS` (`wallet-shared.ts:18-25`) amarra `kind`+`type` juntos e a tela não escolhe sinal; `BALANCE_EXPR` (`wallet.ts:16-23`) trata `credit` positivo e `debit` negativo do ponto de vista do motoboy, consistente com a documentação do schema.
- **Transação `pending` não entra no saldo**: `BALANCE_EXPR` filtra `status = 'confirmed'`, e o extrato só move o `runningBalance` em linhas confirmadas (`wallet.ts:118-127`). Confirmar/rejeitar só funciona na própria carteira e só a partir de `pending` (`finance.ts:67-96`).
- **Virada de mês no extrato**: `getStatement` desloca 3 h no SQL (`wallet.ts:74`, `:88`, `:107-110`) e `parseMonth` usa o mês de Brasília como padrão (`wallet-shared.ts:34-40`). O painel também faz certo (`app/page.tsx:66-81`). Só `finance.ts:105-145` e `planLimits.ts:42-54` ficaram de fora.
- **Débito só para dinheiro vivo**: PIX e cartão não geram débito na carteira (`logistics.ts:388`) — está certo, esse dinheiro vai direto pra loja.
- **Fee do PDV tem precedência sobre a regra da loja**: `logistics.ts:351` usa `delivery.fee` quando > 0 e só cai na regra fixa quando é 0. O webhook ignora `body.fee` de propósito e avisa o PDV com `feeIgnored` (`integration/delivery/route.ts:89`, `:169`).
- **Validação de campos do webhook**: endereço obrigatório e aparado (`:59-65`), JSON quebrado devolve 400 e não 500 (`:42-56`), valor passa por `parseMoney` e recusa NaN/negativo (`:69-85`), todos os textos têm `slice` de tamanho. `addressParts` é limpo campo a campo por `str()` (`:17-19`, `:101-110`).
- **Geocode falho não impede a criação**: o webhook grava a corrida com `lat/lng = 0` e `geo_precision = null` (`:92`, `:118`), e a tela de conferência avisa o operador. Comportamento correto.
- **`confirmUrl`/`trackingUrl` do webhook** usam `APP_URL` lida em runtime, não `request.url` (`integration/delivery/route.ts:163`). Não é o helper `absoluteUrl()`, mas o efeito é o mesmo e não sofre do problema do `localhost:3000`.
- **`PRAGMA foreign_keys = ON`** ativo em `db/index.ts:14` (verificado no banco) e a exclusão de motoboy virou desativação, como o comentário documenta.
- **Push não derruba a ação principal**: todos os envios são `pushToMotoboys(...).catch(() => {})` fora do caminho crítico (`logistics.ts:79`, `:219`, `:262`, `:421`; `drafts.ts:131`; `routes.ts:115`). Aceitar corrida não falha se o push falhar.
- **Push com `urgency: "high"` e TTL 600** em todos os envios (o único ponto de envio é `sendToSubscriptions`, `push.ts:37`), e 404/410 apaga a inscrição morta (`push.ts:41-43`).
- **Inscrição de push duplicada por aparelho**: resolvida com `DELETE` por `endpoint` antes do `INSERT` (`actions/push.ts:24`) mais o índice único de `endpoint` no banco.
- **`add_transaction_kind_column.js` é idempotente**: checa `PRAGMA table_info` antes do ALTER e os backfills têm `WHERE kind<>...`/`kind='ajuste'`, que não se repetem após a primeira execução. Os outros scripts de `scripts/utils/` seguem o mesmo padrão.
- **`busy_timeout` está em 5000 ms** (padrão do better-sqlite3 12.5.0, verificado no banco) — não é fonte de `SQLITE_BUSY` aqui.
- **Duplicidade de crédito no banco de produção local**: consultei `transactions` agrupando por `(related_delivery_id, type)` — nenhuma duplicata hoje.

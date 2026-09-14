# Segurança — achados

## Resumo (3-6 linhas)

Li arquivo por arquivo sessão/autenticação, todas as 22 server actions, todas as 13 rotas de API, as 5 páginas públicas e o DDL do `sqlite.db` local. A base é melhor do que a média: sessão HMAC com comparação timing-safe, tokens públicos aleatórios, escopo por loja bem feito em motoboy/carteira/financeiro, sem SQL injection e sem XSS. O buraco grave é **um só e é sério**: o cookie de "2FA pendente" é assinado com o MESMO formato do cookie de sessão, então quem sabe a senha copia o valor de um pro outro e pula o segundo fator inteiro. Depois disso vêm dois problemas de dinheiro/custo (crédito duplicado por corrida sem trava no banco; proxy do Google Places aberto pra qualquer um) e a ausência total de limite de tentativas em todo o app. Também achei uma chave admin escrita direto no código de uma página pública. Confirmei que `.env.local` nunca foi pro git e que não há segredo em `public/` nem nos scripts.

## Achados

### [P0] Cookie de "2FA pendente" É um cookie de sessão válido — segundo fator pode ser pulado

- **Onde:** `src/lib/session.ts:48-51` (`buildToken`), `src/lib/session.ts:101-107` (`setTwoFactorPendingCookie`), `src/lib/session.ts:53-69` (`parseToken`), `src/lib/session.ts:95-99` (`getSessionUserId`); disparado em `src/app/actions/auth.ts:50-53`, `src/app/actions/passkeys.ts:182-184`, `src/app/api/auth/google/callback/route.ts:66-68`
- **O que:** `setTwoFactorPendingCookie` grava `buildToken(userId)` — exatamente o mesmo valor e a mesma assinatura que `setSessionCookie` gravaria. `parseToken` não distingue os dois: valida a assinatura e devolve o id. Ou seja, o valor do cookie `2fa_pending` colado no cookie `session` autentica a pessoa por completo. Não existe nada no token dizendo "isto ainda é meio login".
- **Como reproduzir / cenário concreto:** conta com 2FA ligado. `curl -i -X POST https://zapentregas.duckdns.org/login` com telefone e senha corretos → a resposta traz `Set-Cookie: 2fa_pending=7.1757…​.AbCd…`. Basta então mandar `curl -H "Cookie: session=7.1757….AbCd…" https://zapentregas.duckdns.org/app` — entra logado, sem nunca digitar o código de 6 dígitos. O `httpOnly` não protege: quem faz o pedido está lendo o cabeçalho da própria resposta.
- **Impacto:** o 2FA vira enfeite para qualquer conta do app (inclusive a do admin, user 1). Quem roubar/adivinhar a senha entra mesmo com o segundo fator ativo. Agrava: `TOKEN_MAX_AGE_MS` (30 dias, `session.ts:20`) vale também pro `2fa_pending`, então o `maxAge` de 5 minutos do cookie (`session.ts:22`) não limita nada do lado do servidor — o token pendente continua aceito por 30 dias.
- **Correção sugerida:** separar os dois tokens — por exemplo, assinar o pendente com um prefixo de propósito (`2fa:${userId}.${ts}`) e fazer `parseToken` exigir/recusar o prefixo conforme o cookie que está lendo; e conferir a idade do pendente contra 5 minutos, não contra 30 dias.
- **Confiança:** alta (li as duas funções; usam literalmente a mesma `buildToken`/`parseToken`).

---

### [P1] Corrida pode gerar crédito duplicado na carteira do motoboy (sem trava no banco)

- **Onde:** `src/app/actions/logistics.ts:365-384` (lê `existingByType`, depois insere); banco: tabela `transactions` sem índice único em `(related_delivery_id, type)` — o único índice é `transactions_delivery_idx`, que **não** é unique (confirmado no DDL)
- **O que:** a idempotência de "finalizar corrida" é um lê-depois-escreve: consulta se já existe crédito para aquela entrega e, se não existir, insere. Entre a consulta e o insert há `await`, e o Next atende outros pedidos nesse intervalo. Nada no banco impede o segundo insert.
- **Como reproduzir / cenário concreto:** o motoboy toca duas vezes em "Finalizar" (ou dispara duas chamadas em paralelo) na corrida #42, taxa R$ 8,00 → as duas execuções leem `existingByType = []` → duas linhas `credit / kind=corrida / 8,00 / related_delivery_id=42`. O saldo (`src/lib/wallet.ts:16-23`) soma as duas: a loja passa a dever R$ 16,00 por uma corrida de R$ 8,00. Mesma coisa com o débito de dinheiro recebido (`logistics.ts:388-399`), que pode ser lançado em dobro contra o motoboy.
- **Impacto:** perde dinheiro de verdade, dos dois lados, e o erro não aparece na tela — só no fechamento do mês, no extrato.
- **Correção sugerida:** criar índice único parcial em `transactions(related_delivery_id, type)` quando `related_delivery_id` não é nulo, e tratar a violação como "já lançado"; ou envolver leitura+insert numa transação do better-sqlite3 (`db.transaction`), que é síncrona e fecha a janela.
- **Confiança:** alta (li o código e o DDL; o índice único não existe).

---

### [P1] Nenhum limite de tentativas em lugar nenhum do app

- **Onde:** `src/app/actions/auth.ts:20-57` (login), `src/app/actions/auth.ts:59-77` (código 2FA), `src/app/actions/invite.ts:17` (aceitar convite), `src/app/actions/password-reset.ts:69` (redefinir senha), `src/app/api/integration/delivery/route.ts:28` (webhook do PDV), `src/lib/registerInvite.ts:25-29` (código de convite de lojista). Busca por `rate.?limit|throttle|attempts|lockout` em `src/` só devolve o debounce de digitação do autocomplete.
- **O que:** não existe contador de tentativas, bloqueio temporário nem atraso progressivo em nenhum ponto de autenticação ou de entrada de terceiros.
- **Como reproduzir / cenário concreto:** (a) um script tenta senhas contra `/login` para o telefone do lojista — o bcrypt custo 10 segura ~10-20 tentativas/s por conexão, mas em paralelo isso não é barreira; (b) com o P0 corrigido, ainda dá pra varrer o TOTP de 6 dígitos (1 milhão de combinações, janela ±1) porque `verifyTwoFactorAction` aceita chamadas infinitas enquanto o cookie pendente valer — e ele vale 30 dias no servidor; (c) `REGISTER_SHOPKEEPER_CODE` é comparado com `===` simples (`registerInvite.ts:28`) e sem limite: dá pra adivinhá-lo por força bruta e se auto-cadastrar como **lojista**, que vê endereço, telefone e dinheiro.
- **Impacto:** qualquer conta do app é alvo de força bruta; o código que "fecha" o cadastro de lojista é adivinhável; o webhook do PDV pode ser inundado (cada POST dispara uma geocodificação paga no Google).
- **Correção sugerida:** um limitador simples em memória por IP+identificador (ex.: 10 tentativas / 15 min) nas quatro entradas de autenticação e no webhook; para o 2FA, contar tentativas por `pendingId` e invalidar o cookie pendente após ~5 erros.
- **Confiança:** alta (confirmado por busca em toda a árvore `src/`).

---

### [P1] `/api/places/autocomplete` e `/api/places/details` são proxy do Google sem nenhuma autenticação

- **Onde:** `src/app/api/places/autocomplete/route.ts:5-47`, `src/app/api/places/details/route.ts:5-37`
- **O que:** as duas rotas leem a query da URL e repassam pro Google Places usando `GOOGLE_MAPS_API_KEY` (a chave do SERVIDOR, sem restrição por site — é a mesma usada no geocode). Não há checagem de sessão, de origem, nem limite de chamadas.
- **Como reproduzir / cenário concreto:** `for i in $(seq 1 100000); do curl "https://zapentregas.duckdns.org/api/places/autocomplete?query=rua$i"; done` — cada chamada é uma sessão de Autocomplete faturada na conta Google do Thon. O `details` idem. Nada nas rotas identifica quem chamou.
- **Impacto:** um terceiro qualquer queima a cota/fatura do Google Places e, quando ela estourar, o geocode das corridas reais para de funcionar (a chave é a mesma de `src/lib/geocode.ts:169`). Também vaza `data.error_message` do Google direto pro chamador (`autocomplete/route.ts:42`).
- **Correção sugerida:** exigir sessão (`getAuthUser()`) nas duas rotas — quem usa o autocomplete é sempre alguém logado (ou o caixa com `confirmToken`, que pode ser aceito como credencial alternativa); e devolver mensagem genérica em vez do `error_message` do Google.
- **Confiança:** alta.

---

### [P1] Chave de admin escrita no código de uma página pública (e a página não tem guarda)

- **Onde:** `src/app/admin/master/products/new/page.tsx:41` — `"X-ADMIN-KEY": "admin_master_secret_key", // Em produção, pegar de env/session`; o arquivo começa com `"use client"` (linha 1) e não tem nenhuma checagem de sessão
- **O que:** uma credencial literal foi deixada no código de um componente de cliente, ou seja, ela é entregue no pacote JavaScript para qualquer visitante. Além disso a página `/admin/master/products/new` abre para quem não está logado — é a única página sob `/admin` sem guarda (todas as outras chamam `getSessionUserId()` + checagem de papel).
- **Como reproduzir / cenário concreto:** abrir `https://zapentregas.duckdns.org/admin/master/products/new` sem login → a tela carrega; ver o código-fonte do bundle → a string `admin_master_secret_key` está lá. Hoje o `POST /api/master/products` recusa (`requireMasterAdminKey` compara com `MASTER_ADMIN_KEY`, que no `.env.local` tem 24 caracteres e é outra coisa), então o efeito imediato é a tela só dar erro. Mas no dia em que alguém "consertar" o cadastro de produtos colocando essa string na env, a API master inteira (criar produto, listar produtos, ler estatísticas consolidadas) fica aberta ao mundo.
- **Impacto:** credencial hardcoded publicada; página administrativa acessível sem login; armadilha para um vazamento total da API master.
- **Correção sugerida:** tirar o header do código de cliente (a chamada deveria passar por uma server action com `getAuthUserWithRole("admin")`) e pôr a mesma guarda de sessão das outras páginas de `/admin`.
- **Confiança:** alta.

---

### [P1] Dados pessoais do cliente de uma loja chegam a todos os motoboys de todas as lojas (agravante da dívida conhecida)

- **Onde:** `src/app/app/page.tsx:255-266` (motoboy lê todo `status = "pending"` sem filtro de loja), `src/app/app/page.tsx:17-23` (`DEFAULT_VISIBILITY` com `showCustomerName: true` e `showCustomerPhone: true`), `src/lib/push.ts:87-95` (`pushToMotoboys` manda para `role in ("motoboy","admin")`, sem escopo), `src/app/actions/drafts.ts:131-136` e `src/app/actions/logistics.ts:79-84` (o corpo do push é o endereço cru)
- **O que:** a dívida "motoboy vê pending de todas as lojas" já é conhecida e aceita. O que reporto como novidade é o alcance: o que vaza não é só "existe uma corrida", é **nome, telefone e endereço do cliente final** — e mais: o endereço sai por notificação push para o celular de todo motoboy cadastrado, mesmo os de outra loja. Pior, quando a loja ainda não salvou as Configurações (não existe linha em `shop_settings`), vale o `DEFAULT_VISIBILITY`, que mostra nome **e telefone** do cliente.
- **Como reproduzir / cenário concreto:** loja B se cadastra hoje e lança uma corrida. O motoboy João, da loja A (Vapor Fumê), abre `/app` e vê a corrida da loja B com "Maria Silva / (34) 9xxxx-xxxx / Rua tal, 123". E, mesmo com o app fechado, o celular dele apita com "🏍️ Nova Corrida Disponível — Rua tal, 123".
- **Impacto:** dado pessoal de cliente de terceiro (LGPD) distribuído a pessoas sem relação com a loja. Além da exposição, o push carrega o endereço para fora do app, para um aparelho que o dono da loja não controla.
- **Correção sugerida:** ou fechar o escopo (motoboy só vê `pending` das lojas a que pertence, via `users.shopkeeper_id`), ou — se o pool aberto é intencional — esconder nome/telefone do cliente enquanto a corrida não for aceita e tirar o endereço do corpo do push (mandar só "Nova corrida em <bairro>").
- **Confiança:** alta.

---

### [P2] `optimizeSelectedRouteAction`: motoboy reordena e lê endereços de corridas de outras lojas

- **Onde:** `src/app/actions/logistics.ts:104-108` (filtro `visible`), `logistics.ts:133` (grava lat/lng), `logistics.ts:152-154` (grava `stopOrder`), `logistics.ts:158-162` (devolve os endereços numa URL do Google Maps)
- **O que:** o filtro de visibilidade aceita, para motoboy, qualquer entrega com `status === "pending"` — sem olhar de que loja é. O resultado não é só leitura: a action **escreve** `stopOrder` (e às vezes lat/lng) nessas entregas e devolve a lista de endereços concatenada.
- **Como reproduzir / cenário concreto:** o motoboy chama a action com `selectedIds = [1,2,3,...,500]`. Todas as entregas `pending` do banco, de todas as lojas, entram; ele recebe de volta um link do Google Maps com os endereços de todas elas, e a ordem de parada da loja B fica renumerada segundo a rota dele.
- **Impacto:** extração em massa de endereços (bem além do que a tela mostra) e adulteração da ordem de rota de outra loja.
- **Correção sugerida:** restringir o filtro do motoboy a `d.motoboyId === me.id` (a otimização de rota só faz sentido nas corridas que ele já aceitou) ou, no mínimo, exigir que a loja das entregas seja a mesma.
- **Confiança:** alta.

---

### [P2] `getMotoboyLocationAction` é uma server action sem autenticação nenhuma

- **Onde:** `src/app/actions/tracking.ts:35-48`
- **O que:** o arquivo é `"use server"`, então toda função exportada vira um endpoint. Esta não chama `getAuthUser()` nem confere nada: recebe um `motoboyId` e devolve nome, latitude, longitude e horário da última posição de qualquer usuário.
- **Como reproduzir / cenário concreto:** quem descobrir o identificador da action manda `POST /` com `Next-Action: <id>` e corpo `[3]`, `[4]`, `[5]`… e monta o rastro de GPS ao vivo de todos os motoboys da operação, sem login e sem token de rastreio.
- **Impacto:** localização em tempo real de pessoas exposta. Atenuante importante: a função só é importada por um Server Component (`src/app/tracking/[id]/page.tsx:7`), nunca por componente de cliente — então o identificador da action não vai para o pacote do navegador e não é trivial de descobrir. É segurança por obscuridade, não por controle.
- **Correção sugerida:** transformá-la em função normal (sem `"use server"`, num arquivo `lib/`) já que só o servidor a usa; ou exigir sessão e que o chamador tenha vínculo com aquele motoboy.
- **Confiança:** alta no defeito; média no risco prático (depende de o identificador da action vazar).

---

### [P2] Vincular conta Google sobrescreve o e-mail do usuário sem checar duplicidade → erro 500

- **Onde:** `src/app/api/auth/google/callback/route.ts:50-52`; índice `users_email_unique` no banco (confirmado no DDL)
- **O que:** no modo "conectar conta" o callback faz `set({ googleId, email: profile.email })` sem verificar se aquele e-mail já pertence a outra conta. Como a coluna tem índice único, o update estoura e a exceção não é tratada. Também troca, calado, o e-mail que a pessoa tinha cadastrado.
- **Como reproduzir / cenário concreto:** o motoboy João já existe com `email = maria@gmail.com` (cadastro antigo). Maria entra em Configurações e clica "Conectar Google" com a conta `maria@gmail.com` → `UNIQUE constraint failed: users.email` → tela de erro do Next em vez de "esse e-mail já está em uso". No caminho feliz, o e-mail antigo da pessoa é substituído sem aviso — e é por e-mail que o "esqueci a senha" acha a conta.
- **Impacto:** erro 500 na cara do usuário; troca silenciosa de um dado usado para recuperação de conta.
- **Correção sugerida:** antes do update, procurar `users.email = profile.email` e, se for outra conta, voltar com `?erro=google_email_em_uso` — a mesma regra que `src/lib/google-login.ts:40-47` já aplica no caminho de login.
- **Confiança:** alta.

---

### [P2] Duas aceitações simultâneas: a segunda sobrescreve a primeira sem ninguém perceber

- **Onde:** `src/app/actions/logistics.ts:202-216`
- **O que:** o UPDATE tem `where status = 'pending'` (bom), mas o resultado não é conferido — não há `.returning()` nem contagem de linhas — e a leitura anterior (`findFirst`) já passou. Duas execuções concorrentes rodam os dois UPDATEs; o segundo ainda encontra `status='pending'`? Não; mas o primeiro já mudou o status, então o segundo não grava nada — e mesmo assim devolve `{ success: true }`.
- **Como reproduzir / cenário concreto:** dois motoboys tocam "Aceitar" na mesma corrida no mesmo segundo. Os dois veem "aceita com sucesso"; só um está de fato com `motoboyId`. O outro sai para a loja atrás de um pedido que não é dele.
- **Impacto:** confusão operacional e corrida "fantasma" na tela do motoboy que perdeu.
- **Correção sugerida:** usar `.returning()` no UPDATE e, se vier vazio, devolver "outro motoboy pegou primeiro".
- **Confiança:** alta.

---

### [P2] Cabeçalhos de segurança ausentes; e `PDV_FRAME_ANCESTORS` não existe no compose

- **Onde:** `src/proxy.ts:14-30` (só define `frame-ancestors` e `X-Frame-Options`), `nginx-zapentregas.conf:1-21` (nenhum cabeçalho de segurança; só o bloco :80), `docker-compose.yml:12-39`
- **O que:** não há `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` nem CSP de scripts em lugar nenhum. Separadamente: o `docker-compose.yml` do repositório **não passa** `PDV_FRAME_ANCESTORS`, nem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, nem `ANDROID_CERT_FINGERPRINTS` — variáveis que o código lê em runtime (`proxy.ts:18`, `src/lib/push.ts:9-12`, `src/app/api/assetlinks/route.ts:15`).
- **Como reproduzir / cenário concreto:** `curl -I https://zapentregas.duckdns.org/app` — sem HSTS, o primeiro acesso digitado sem `https://` pode ser interceptado. E, com `PDV_FRAME_ANCESTORS` vazio, `/confirmar/<token>` sai com `frame-ancestors 'self'`: o iframe do PDV do EpicStore é bloqueado pelo navegador (falha fechada — seguro, mas quebra a conferência do caixa).
- **Impacto:** proteção de transporte e de tipo de conteúdo abaixo do padrão; e um risco alto de a tela de conferência do caixa parar de funcionar num redeploy que use este compose.
- **Correção sugerida:** acrescentar HSTS + `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` no `proxy.ts`, e completar o `docker-compose.yml` com as variáveis que faltam.
- **Confiança:** alta no código; média em produção (o compose e o nginx da VPS podem já estar diferentes dos do repositório — o arquivo aqui só tem o bloco :80, então o certbot provavelmente reescreveu o de lá).

---

### [P2] Enumeração de usuários no cadastro e oráculo de conta desativada no login

- **Onde:** `src/app/actions/register.ts:59-61` ("Este número de celular já está cadastrado"), `register.ts:75-79` ("Este e-mail já está cadastrado"), `src/app/actions/auth.ts:41-43` (checa `isActive === false` **antes** de conferir a senha)
- **O que:** `/register` é público e responde de forma diferente para telefone/e-mail que existem e que não existem. No login, a mensagem "Conta desativada" sai antes da verificação de senha, então serve como confirmação de que aquele telefone existe no sistema.
- **Como reproduzir / cenário concreto:** um script varre DDDs em `/register` com senha qualquer e monta a lista de celulares cadastrados no Zap; depois manda cada um pro `/login` com senha aleatória e separa quem está desativado.
- **Impacto:** lista de telefones de lojistas e motoboys para golpe direcionado por WhatsApp — que é justamente o canal do produto.
- **Correção sugerida:** mover a checagem de `isActive` para depois do `verifyPassword` e, no cadastro, usar mensagem genérica ("não foi possível criar a conta com esses dados") — sem apontar qual campo colidiu.
- **Confiança:** alta.

---

### [P2] `/api/notifications/check` derruba com 500 se `lastCheck` não for número

- **Onde:** `src/app/api/notifications/check/route.ts:18` — `new Date(Number(lastCheck))`, usado em `.toISOString()` nas linhas 24, 67, 84 e 100
- **O que:** `Number("abc")` é `NaN`, `new Date(NaN)` é uma data inválida e `.toISOString()` numa data inválida lança `RangeError`. O handler não tem try/catch.
- **Como reproduzir / cenário concreto:** logado, abrir `GET /api/notifications/check?lastCheck=abc` → 500. O app chama essa rota em laço no celular do motoboy; um parâmetro corrompido no `localStorage` derruba as notificações dele em silêncio.
- **Impacto:** indisponibilidade da notificação por polling; ruído de erro no log.
- **Correção sugerida:** validar `Number.isFinite(n)` antes de montar a data e cair no padrão de 30 s quando não for.
- **Confiança:** alta.

---

### [P2] API master: `limit` sem teto e `metadata` sem tamanho

- **Onde:** `src/app/api/master/events/route.ts:75` (`parseInt(searchParams.get("limit") || "50")`, sem `Math.min`), `master/events/route.ts:46-53` (grava `body.event`, `body.userId`, `body.metadata` sem cortar nem validar)
- **O que:** quem tem a API key de um produto lê a coleção inteira de eventos numa requisição e grava campos de tamanho arbitrário. Compare com `src/app/api/logs/route.ts:60`, que faz `Math.min(..., 500)` e corta todos os campos.
- **Como reproduzir / cenário concreto:** `GET /api/master/events?limit=99999999` com a API key do produto devolve tudo de uma vez; `POST` com um `metadata` de 50 MB engorda o `sqlite.db`, que é o mesmo arquivo do app inteiro.
- **Impacto:** disco do container e memória do processo; num SQLite único isso afeta a operação toda.
- **Correção sugerida:** aplicar teto no `limit` e `.slice()` nos campos de texto, como a rota de logs já faz.
- **Confiança:** alta.

---

### [P2] Redefinição de senha: token antigo continua valendo e nada é invalidado depois

- **Onde:** `src/app/actions/password-reset.ts:37-41` (insere token novo sem apagar os anteriores), `password-reset.ts:106-113` (troca a senha e marca só o token usado), `src/lib/password.ts:32-35` (validade de 15 min)
- **O que:** cada pedido cria mais uma linha em `password_resets`; os pedidos anteriores continuam válidos até vencer. Trocar a senha (aqui, ou por `changePasswordAction`, ou pelo "Redefinir acesso" da loja) não invalida os tokens pendentes nem as sessões abertas.
- **Como reproduzir / cenário concreto:** um atacante que tenha visto um link de reset em 15 minutos ainda consegue usá-lo mesmo depois de a pessoa já ter trocado a senha por outro caminho — e o login continua funcionando com o cookie antigo (o logout não invalida token, dívida já conhecida).
- **Impacto:** janela de retomada de conta após um incidente. Hoje o alcance é pequeno porque a tela `/login/forgot-password` virou estática (`src/app/login/forgot-password/page.tsx`) e `requestPasswordResetAction` não é mais chamada por ninguém — mas ela continua exportada e, portanto, viva como endpoint.
- **Correção sugerida:** marcar os tokens anteriores do mesmo usuário como usados ao emitir um novo e ao trocar a senha; e remover `requestPasswordResetAction` se o fluxo por e-mail foi mesmo aposentado.
- **Confiança:** alta.

---

### [P2] `createRouteAction` aceita lista de endereços sem limite (cada um vira uma geocodificação)

- **Onde:** `src/app/actions/routes.ts:18-24` e `routes.ts:62-70`
- **O que:** `formData.getAll("address")` não tem teto e cada endereço dispara `geocodeAddress`, que pode encadear Google + até 3 tentativas no Nominatim com espera de 1,1 s entre elas (`src/lib/geocode.ts:51-56`).
- **Como reproduzir / cenário concreto:** um lojista (ou uma conta criada pelo código de convite adivinhado) posta 2.000 endereços diferentes → o handler segura o processo por horas em `await` de rede e queima cota do Google. Como é um processo Node só, isso trava o app para todo mundo.
- **Impacto:** indisponibilidade e custo, a partir de uma conta de lojista comum.
- **Correção sugerida:** limitar a ~30 endereços por rota e cortar o tamanho de cada campo.
- **Confiança:** alta.

---

### [P3] Sem índice único em `reviews.delivery_id` → avaliação em dobro inflando a nota

- **Onde:** `src/app/actions/review.ts:40-44` (checa "já avaliada" antes de inserir); DDL da tabela `reviews` — chave estrangeira em `delivery_id`, nenhum índice único
- **O que:** mesma forma do problema do crédito duplicado: lê e depois escreve, sem trava no banco. E, além da linha duplicada, o cálculo de média em `review.ts:69-87` roda duas vezes.
- **Como reproduzir / cenário concreto:** o cliente clica duas vezes em "Enviar avaliação" no `/review/<token>` → duas linhas e `rating_count` do motoboy sobe 2 com uma avaliação só.
- **Impacto:** nota do motoboy manipulável por quem tem o link de avaliação (que é o mesmo token do rastreio).
- **Correção sugerida:** `CREATE UNIQUE INDEX ON reviews(delivery_id)` e tratar a violação como "já avaliada".
- **Confiança:** alta.

---

### [P3] `users.api_key` sem índice único

- **Onde:** DDL da tabela `users` (coluna `api_key` sem unique); `src/app/api/integration/delivery/route.ts:21-26` faz `findFirst(eq(users.apiKey, apiKey))`; geradores em `src/app/actions/settings.ts:180-183` e `src/app/actions/admin-users.ts:105-108`
- **O que:** a autenticação do webhook do PDV depende de a chave ser única, mas o banco não garante isso (compare com `master_products_api_key_unique`, que existe). Como a parte aleatória tem 24 bytes, colidir na prática é impossível — o risco real é operacional: um script de migração ou um restore podendo duplicar chaves e `findFirst` escolher a loja errada.
- **Impacto:** baixo hoje; é uma garantia que o código assume e o banco não dá.
- **Correção sugerida:** índice único parcial em `users(api_key) WHERE api_key IS NOT NULL`.
- **Confiança:** alta.

---

### [P3] Webhook do PDV aceita chave de lojista desativado ou suspenso

- **Onde:** `src/app/api/integration/delivery/route.ts:21-26` — filtra só por `apiKey` e `role = "shopkeeper"`
- **O que:** não confere `isActive` nem `subscriptionStatus`. Uma loja desligada no painel (`adminToggleUserActiveAction`, `deleteUserAction`) continua criando corridas pelo PDV — o usuário não consegue mais entrar no app, mas a integração segue viva.
- **Impacto:** loja "cortada" continua consumindo geocodificação e enchendo a fila de rascunhos.
- **Correção sugerida:** acrescentar `ne(users.isActive, false)` ao `where` da autenticação.
- **Confiança:** alta.

---

### [P3] Upload confia no tipo declarado pelo navegador; arquivo servido sem autenticação

- **Onde:** `src/lib/upload.ts:23-26` (usa `file.type`, que é escolhido por quem envia), `src/app/api/uploads/[filename]/route.ts:18-66` (GET sem sessão)
- **O que:** a validação de formato é feita pelo cabeçalho MIME informado pelo cliente, não pelos primeiros bytes do arquivo. Qualquer conteúdo pode ser gravado com extensão `.png`. Servir é público — sem sessão nenhuma.
- **Como reproduzir / cenário concreto:** um usuário logado envia um HTML declarado como `image/png` → fica salvo como `<uuid>.png`. Ao ser buscado, volta com `Content-Type: image/png` e `X-Content-Type-Options: nosniff` (`route.ts:60`), o que **impede** o navegador de executá-lo: não vira XSS. Sobra o uso do servidor como hospedagem de arquivo arbitrário e o fato de as fotos de perfil serem públicas para quem souber o nome (que é um UUID aleatório).
- **Impacto:** baixo. O `nosniff` já corta o caminho perigoso; a travessia de diretório está corretamente bloqueada (`route.ts:25-34`).
- **Correção sugerida:** conferir os bytes iniciais (assinatura JPEG/PNG/WebP) antes de gravar; opcionalmente reprocessar com `sharp`, que já é dependência do projeto.
- **Confiança:** alta.

---

### [P3] `MASTER_ADMIN_KEY`: comparação vaza o tamanho e não é timing-safe

- **Onde:** `src/app/api/master/products/route.ts:6-15` e `src/app/api/master/stats/route.ts:6-15` — `if (provided.length !== expected.length) return false;` e depois `Buffer.equals`
- **O que:** a saída antecipada por tamanho revela o comprimento da chave, e `Buffer.equals` para no primeiro byte diferente (ao contrário de `crypto.timingSafeEqual`, que o próprio projeto já usa em `src/lib/session.ts:41-46`).
- **Impacto:** baixo — extrair uma chave por medição de tempo pela internet é impraticável. Reporto por consistência com o padrão que o projeto já adota.
- **Correção sugerida:** trocar por `crypto.timingSafeEqual` sobre hashes dos dois valores (assim o tamanho também deixa de vazar).
- **Confiança:** alta.

---

### [P3] Inscrição de push pode ser tomada por outro usuário logado

- **Onde:** `src/app/actions/push.ts:24-31` — apaga qualquer linha com aquele `endpoint` (sem filtrar por dono) e insere com o próprio `userId`
- **O que:** o comentário explica a intenção (mesmo celular trocando de conta), mas o efeito colateral é que quem souber o endpoint de outra pessoa passa a receber as notificações dela. A remoção (`push.ts:44-47`) já filtra por dono corretamente.
- **Como reproduzir / cenário concreto:** o endpoint do FCM não circula publicamente, então o atacante precisaria de acesso ao aparelho ou ao banco — cenários em que já perdeu o jogo. Baixo risco real.
- **Correção sugerida:** guardar também um identificador de aparelho e só reatribuir quando a requisição vier do mesmo `endpoint` + comprovação; ou aceitar o risco documentado.
- **Confiança:** alta no código; baixa no risco prático.

---

### [P3] Expressão regular montada com texto do lojista no geocode do Google

- **Onde:** `src/lib/geocode.ts:163` — `new RegExp(city, "i")`, com `city` vindo de `shop_settings.default_city` (digitado no formulário de Configurações, `src/app/actions/settings.ts:35`, sem validação de conteúdo). A linha está **fora** do `try` que começa na 180.
- **O que:** um valor como `(((` faz o `new RegExp` lançar antes do try, e um valor como `(a+)+$` pode fazer o casamento demorar de forma explosiva.
- **Como reproduzir / cenário concreto:** o lojista salva "Cidade padrão" com um texto que não é regex válida → toda geocodificação daquela loja passa a estourar exceção (capturada pelos chamadores, que gravam a corrida em lat/lng 0,0 — sem pino no mapa e sem cerca geográfica).
- **Impacto:** só a própria loja se prejudica; é auto-infligido. Mas quebra em silêncio.
- **Correção sugerida:** trocar por comparação simples de texto (`partes[0].toLowerCase().includes(city.toLowerCase())`).
- **Confiança:** alta.

---

## Coisas verificadas e OK (lista curta — pra não re-auditar)

- **Assinatura da sessão:** `crypto.timingSafeEqual` com checagem de tamanho antes (`src/lib/session.ts:41-46`); HMAC-SHA256; `SESSION_SECRET` obrigatória com mínimo de 32 caracteres, lançando erro se faltar (`session.ts:24-32`). Expiração de 30 dias conferida no servidor (`session.ts:66`). Cookies `httpOnly` + `sameSite=lax` + `secure` em produção (`session.ts:71-79`).
- **Nenhuma injeção de SQL:** todos os 30 usos de `` sql`` `` em `src/` interpolam por parâmetro do Drizzle (conferi um a um em `finance.ts`, `financial-records.ts`, `wallet.ts`, `app/page.tsx`). Nenhuma concatenação de string em consulta.
- **Nenhum XSS:** só um `dangerouslySetInnerHTML` no projeto (`src/app/page.tsx:220`) e ele injeta a constante estática `LANDING_CSS`. Nenhum `href` com `javascript:`, nenhum `eval`/`new Function`. Texto vindo do PDV (nome, endereço, observação) é sempre renderizado como filho de JSX, que o React escapa.
- **Sem redirecionamento aberto:** `safeReturnTo` (`src/lib/wallet-shared.ts:43-46`) barra `//host` e `/\host`; é usado nos dois pontos que aceitam `returnTo` (`finance.ts:60`, `finance/new/page.tsx:29`). Todos os outros `redirect()` usam caminho literal ou `absoluteUrl()`.
- **Sem SSRF:** as chamadas externas têm host fixo (`maps.googleapis.com`, `nominatim.openstreetmap.org`, `viacep.com.br`) e só a query varia; o CEP é reduzido a 8 dígitos antes de entrar na URL (`geocode.ts:286-287`).
- **Travessia de diretório em `/api/uploads/[filename]`:** bloqueada corretamente com `path.basename` + `resolve` + verificação de prefixo (`route.ts:25-34`).
- **OAuth do Google:** `state` aleatório de 24 bytes em cookie `httpOnly`, conferido e apagado no callback (`api/auth/google/route.ts:14,19-25`; `callback/route.ts:15-21,35`); `aud`, `iss` e `exp` do `id_token` validados (`google-oauth.ts:82-93`); `email_verified` exigido (`callback/route.ts:40`); conta nova nasce sempre como `motoboy` (`google-login.ts:56`); e-mail já vinculado a outro `sub` é recusado (`google-login.ts:42-44`).
- **WebAuthn:** desafio de uso único em cookie httpOnly de 5 min (`webauthn.ts:40-57`); `expectedOrigin`/`expectedRPID` derivados de `APP_URL`; contador do autenticador atualizado (`passkeys.ts:175-180`); `deletePasskeyAction` filtra por `userId` (`passkeys.ts:198-200`).
- **Tokens públicos:** rastreio 12 bytes e conferência 24 bytes, ambos `randomBytes` base64url (`trackingToken.ts`); convite 32 bytes (`invite.ts:32`); reset 32 bytes hex (`password.ts:28`). `deliveries.public_token` e `deliveries.confirm_token` têm índice **único** no banco; `password_resets.token` também. O `confirmToken` é apagado no uso, dentro de um UPDATE com `WHERE status='draft'` — a corrida entre dois cliques do caixa está **fechada** (`drafts.ts:115-129` e `144-158`). As páginas `/tracking`, `/review` e `/convite` buscam por token, nunca por id, e a `/convite` mostra só o primeiro nome.
- **Escopo por loja onde importa:** `src/lib/team.ts` centraliza "de quem é o motoboy" e é usado em `motoboy.ts` (editar, convite, reset de acesso, excluir, reativar), `finance.ts:41-44` (lançamento na carteira) e `motoboys/[id]/*`. `financial-records.ts` filtra tudo por `userId` do dono. `drafts.ts` e `deliveries.ts` conferem `shopkeeperId` para lojista e liberam só para admin. `deliveries/history` mascara endereço e telefone para o motoboy.
- **Guardas de papel:** todas as páginas de `/admin` (exceto a de `master/products/new`, reportada acima), `/motoboys`, `/finance`, `/settings`, `/routes/new` e `/deliveries/[id]/*` chamam `requireX()` ou checam `role` explicitamente. `/api/admin/users/update-plan` e `update-status` usam `getAuthUserWithRole("admin")` e validam plano/status contra lista fechada.
- **Confirmação de lançamento:** `confirmTransactionAction` e `rejectTransactionAction` (`finance.ts:63-103`) filtram por `userId` do próprio e por `status='pending'` no WHERE — não dá pra confirmar lançamento alheio.
- **Segredos:** `.env.local` coberto por `.env*` no `.gitignore` e nunca foi comitado (verifiquei todo o histórico das 130 revisões com `--diff-filter=A`). Nada em `public/` além de imagens, `manifest.json` e `sw.js`. Nenhum segredo nos scripts — `create_admin.ts` e `promote_admin.ts` leem tudo do ambiente, e `test_google_login.ts` só usa dados fictícios (`joao@example.com`, hash `$2a$10$fake`) e tem trava explícita contra rodar no banco de produção (`test_google_login.ts:18-22`). A única chave de navegador (`GOOGLE_MAPS_BROWSER_KEY`) é lida em runtime e é, por projeto, separada da chave do servidor (`src/lib/mapsKey.ts`). Nenhum `NEXT_PUBLIC_*` carrega segredo (só `NEXT_PUBLIC_BASE_URL` e `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, que é pública por definição).
- **`POST /api/logs`:** exige sessão, valida `level` contra lista fechada e corta todos os campos (`route.ts:12-44`); o `GET` é só para admin.
- **`/api/assetlinks`:** só lê env e devolve JSON; sem parâmetro de entrada.
- **Cadastro de lojista:** a server action reconfere o código, não confia na tela (`register.ts:43-45`), e o padrão sem `REGISTER_SHOPKEEPER_CODE` é fechado (`registerInvite.ts:26`).
- **Senhas:** bcrypt custo 10; senha em texto puro legada é recusada explicitamente (`password.ts:18-20`); `changePasswordAction` exige a senha atual quando ela existe.
- **Banco (DDL conferido em modo leitura):** índices únicos presentes em `users.phone`, `users.email`, `users.google_id` (parcial), `deliveries.public_token`, `deliveries.confirm_token` (parcial), `password_resets.token`, `shop_settings.user_id`, `master_products.api_key`, `push_subscriptions.endpoint`, `webauthn_credentials.credential_id`. Chaves estrangeiras declaradas em todas as tabelas de relacionamento. **Aviso:** o `sqlite.db` local é de 28/08 e está atrás do código — não tem as colunas `invite_token`, `invite_token_expires_at` e `shopkeeper_id` em `users` (elas são criadas pelas migrações do `CMD` do Dockerfile). Os índices únicos que faltam e reportei acima (`transactions`, `reviews`, `users.api_key`) não são criados por nenhum script de migração, então também não existem em produção.

# Auditoria final — Zap Entregas — 07/09/2026

Quatro auditores independentes (segurança, regras de negócio/dados, infra/deploy, frontend/UX) leram o código em `main` (573bb0d) e a produção na VPS (somente leitura). Build local passa; `tsc` tem 15 erros escondidos por `ignoreBuildErrors`; lint tem 10 erros (nenhum quebra em runtime).

Relatórios completos: `01-seguranca.md`, `02-negocio-dados.md`, `03-infra-deploy.md`, `04-frontend-ux.md`, `05-build-tsc-lint.log`.

Produção agora: container no ar há 23h, 0 reinícios, 0 erros 5xx em 48h, banco íntegro, backup diário funcionando, certificado renova sozinho. Uso real: 55 corridas (29 entregues), 26 lançamentos na carteira, 5 usuários.

## P0 — corrigir antes de qualquer outra coisa (4)

1. **2FA pode ser pulado.** O cookie de "2FA pendente" é assinado igual ao cookie de sessão; quem tem a senha copia um no outro e entra sem o código. `src/lib/session.ts:48-107`.
2. **"Recebi outro valor" com campo vazio grava R$ 0,00 e não lança o dinheiro na carteira.** É o caso padrão quando a loja esconde o valor do pedido. `CompleteDeliveryModal.tsx:40-46`, `logistics.ts:304-314,388`.
3. **Webhook do PDV sem idempotência.** Reenvio (timeout ou "force") vira segunda corrida e segunda taxa. Não existe `external_id`. `api/integration/delivery/route.ts:137-153`.
4. **Chave de assinatura do app Android e a senha dela estão dentro da imagem Docker de produção** (`/app/android/`). `.dockerignore` não exclui `android/`. Confirmado na VPS.

## P1 — esta semana (26, sem duplicatas)

Dinheiro e dados
- Crédito/débito da corrida sem índice único: duas finalizações simultâneas creditam duas vezes. `logistics.ts:365-399`.
- Datas em formato misto (`CURRENT_TIMESTAMP` vs `toISOString`) — comparação no SQLite sempre falha no mesmo dia: mata a trava anti-duplo-clique, o limite de plano no dia 1 e o aviso de corrida nova do polling. `logistics.ts:41`, `routes.ts:37`, `planLimits.ts:50`, `notifications/check/route.ts:24`, `finance.ts:125`.
- "1.850,00" digitado vira R$ 1,85 — sete conversores locais; o certo (`lib/money.ts`) só é usado no webhook.
- Modelos "Por KM", "Diária" e mínimo garantido são oferecidos na tela e pagam R$ 0,00. `logistics.ts:353-363`.
- Conferência do PDV sempre grava `geo_precision = exata` mesmo sem mexer no pino → cerca de 200m mede contra a loja e o motoboy não fecha a entrega. `drafts.ts:84-122`, `DraftConfirmForm.tsx:67-131`.
- Geocode roda dentro da requisição do PDV (até ~6s quando o Google falha) → EpicStore pode dar timeout e reenviar (ver P0 3).

Segurança
- Nenhum limite de tentativas em lugar nenhum (login, 2FA, convite, código de lojista, webhook).
- `/api/places/autocomplete` e `details` são proxy do Google sem login — qualquer um queima a cota.
- `admin/master/products/new` tem chave admin hardcoded no cliente e não tem guarda de sessão.
- Nome, telefone e endereço do cliente de qualquer loja chegam a todos os motoboys (tela + push com endereço). Agravante da dívida conhecida.

Infra e deploy
- `docker-compose.yml` do repo defasado: faltam VAPID×3, PDV_FRAME_ANCESTORS, ANDROID×2; porta `4000:3000` sem `127.0.0.1` (fura o UFW); ainda usa `build: .`.
- `CMD` do Dockerfile roda 4 das 10 migrações — restore de backup antigo sobe e quebra na primeira tela.
- `deploy.sh` + README descrevem um deploy que não existe e é destrutivo (`/var/www`, build na VPS, remove o container).
- Container sem limite de memória (único da VPS); VPS já com 652 MB em swap.
- Backup diário só no mesmo disco; sem cópia fora (cadeia loloserver parada desde 16/08).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` só via build-arg, não documentado — build sem ela = push morre em silêncio.
- Upload de foto acima de 1 MB falha (limite padrão de Server Action); a tela promete 5 MB.

Frontend / motoboy
- Rastreio público: nome da loja e endereço ficam branco no branco em celular com tema escuro. `tracking/[id]/page.tsx:90,100`.
- Nenhum `not-found.tsx` / `error.tsx` / `loading.tsx` no projeto — link velho vira 404 em inglês.
- Motoboy não tem botão "Navegar" por corrida; "Gerar Rota" usa texto do endereço (ignora o pino ajustado), sem trava de duplo clique, e o `window.open` pós-await é bloqueado como pop-up sem erro.
- Cerca de 200m sem saída quando o GPS/pino erra; GPS negado desliga a cerca em silêncio.
- Primeira checagem de notificação despeja até 10 avisos velhos com `requireInteraction` (`lastCheck=0`).
- Histórico carrega tudo sem paginação (admin: o banco inteiro).
- Mesmo lançamento aparece "+ verde" no card de confirmação e "− vermelho" no extrato.
- Botões Aceitar/Peguei/Entregue com ~24px de altura, empilhados no canto em 360px.
- Service worker só é registrado se aceitar notificação e não tem `fetch` — offline e "instalar app" não funcionam.

## P2 (≈30) e P3 (≈15)

Ver os relatórios individuais. Destaques P2: aceitar corrida não confere linhas afetadas (perdedor vê "aceita"); excluir corrida aceita sem aviso e sem cancelamento com estorno; limite de plano ignorado no webhook; GPS grava a cada fix sem throttle; cache de geocode cresce sem limite e guarda falhas 24h; sem índices em `deliveries`; sem WAL (e o bind-mount de arquivo impede ligar); erros de servidor não vão pra `app_logs`; sem healthcheck/rotação de log/HSTS; imagem 3,2 GB como root; TWA não reconstruível (caminho do Ubuntu, versionCode 1); `alert()` e `reload()` em toda ação do motoboy; `/confirmar` não avisa o PDV quando o token expirou; acerto de saldo sem trava de reenvio; recibo errado irreversível; rascunho não expira; vincular Google sobrescreve e-mail sem checar duplicidade (500); enumeração de usuário no cadastro.

## O que está bom (não re-auditar)

Sessão HMAC timing-safe com expiração; sem SQL injection; sem XSS; sem open redirect; OAuth Google com state/aud/iss/exp; WebAuthn correto; tokens públicos aleatórios com índice único; transições de estado com `WHERE status=...`; escopo por loja em motoboy/carteira/financeiro; push não derruba ação principal; `urgency: high`; FK ON; `busy_timeout` 5s; nginx com `127.0.0.1` (fix 06/09 aplicado), redirect 80→443, certbot com plugin nginx; assetlinks OK; APK servido idêntico ao local; `.env.local` nunca foi pro git.

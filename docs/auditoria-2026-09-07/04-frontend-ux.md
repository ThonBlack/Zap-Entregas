# Frontend / UX / Mobile — achados

## Resumo

Auditei as ~40 telas e ~50 componentes de `D:\Zap-Entregas\src` lendo o código (sem rodar nada). A base é boa: a maioria dos inputs tem cor explícita, o fallback Google→Leaflet do mapa está bem feito, o `/confirmar` do PDV é enxuto e sem link pra `/login`, e o "esqueci a senha" é honesto sobre não existir SMTP.

O que está ruim se concentra em três lugares: (1) o **fluxo do motoboy** — o modal de recebimento aceita valor vazio como R$ 0,00 (perde dinheiro), os botões principais têm ~24px de altura, não existe link de navegação por corrida, e a cerca de 200m não tem escape quando o GPS erra; (2) o **casco do app** — não existe nenhum `not-found.tsx`/`error.tsx`/`loading.tsx` no projeto inteiro, então cliente com link velho de rastreio cai num 404 branco em inglês; (3) o **dark mode** — o hack do `--foreground` no `globals.css` continua vivo e já derrubou a página de rastreio: nome da loja e endereço de destino saem branco no branco.

Também achei que o service worker só é registrado quando o usuário aceita notificações e não tem `fetch` handler — ou seja, offline e "instalar app" nunca funcionam de verdade —, e que a checagem de notificação de 10s despeja até 10 avisos velhos toda vez que o app abre e depois nunca mais acha corrida nova (comparação de data quebrada).

**Não cobri** segurança/autorização nem as regras de carteira (outros auditores).

---

## Achados

### [P0] "Recebi outro valor" com o campo vazio grava R$ 0,00 e some com o dinheiro da carteira

- **Onde:** `src/components/deliveries/CompleteDeliveryModal.tsx:40-45`, `src/app/actions/logistics.ts:305-314`, `src/app/actions/logistics.ts:388`
- **O que:** No modal, `const amt = Number(amount.replace(",", "."))` com `amount = ""` devolve `0`. A validação é `!Number.isFinite(amt) || amt < 0` — `0` passa nas duas. O servidor também aceita (`amt >= 0`). Mas na hora de lançar o débito, a condição é `receivedAmount && receivedAmount > 0` (linha 388): `0` é falso, então **nenhum débito é criado**.
- **Como reproduzir / cenário concreto:** João finaliza a corrida #123 (pedido de R$ 180), marca "✏️ Recebi outro valor", escolhe "Dinheiro", **não digita nada** no campo e toca em "Confirmar Entrega" → a corrida vira `delivered` com `receivedAmount = 0`, o histórico da loja mostra "✏️ Recebido (outro valor): R$ 0,00 (dinheiro)" e a carteira não registra que ele está com R$ 180 em espécie.
- **Impacto:** Dinheiro real. A loja perde o rastro do valor que o motoboy está segurando; só descobre no acerto, comparando nota por nota. Um toque errado por dia já bagunça o fechamento.
- **Correção sugerida:** Exigir campo preenchido e `> 0` no cliente quando o status for `valor_diferente` (`if (!amount.trim() || amt <= 0) return setError(...)`), e no servidor rejeitar `valor_diferente` com `amount === 0` — quem não recebeu nada tem a opção "🚫 Não recebi".
- **Confiança:** alta (as três linhas foram lidas e a lógica fecha).

---

### [P1] Rastreio público: nome da loja e endereço de destino ficam brancos no branco em celular com tema escuro

- **Onde:** `src/app/globals.css:15-20` + `src/app/tracking/[id]/page.tsx:90` e `src/app/tracking/[id]/page.tsx:100`
- **O que:** O `globals.css` ainda tem `@media (prefers-color-scheme: dark) { --foreground: #ededed }` e o `body` usa `color: var(--foreground)`. A página de rastreio é clara (`bg-zinc-50` / `bg-white`), e as duas linhas mais importantes dela — `<div className="font-medium">{delivery.shopkeeper?.name}</div>` e `<div className="font-medium">{delivery.address}</div>` — **não têm classe de cor**, então herdam `#ededed`.
- **Como reproduzir / cenário concreto:** Cliente com Android no tema escuro (padrão em muito aparelho) abre o link de rastreio que o motoboy mandou no WhatsApp → vê os rótulos "Loja" e "Destino" em cinza, mas os valores embaixo somem (texto `#ededed` sobre `#fafafa`).
- **Impacto:** O cliente final não vê para onde o pedido vai nem de que loja é. É a única tela do produto que pessoa de fora enxerga.
- **Correção sugerida:** Colocar `text-zinc-900` nessas duas `div` (e conferir as irmãs da mesma tela), e no médio prazo remover o bloco `prefers-color-scheme: dark` do `globals.css` — o app já pinta cor explícita em todo lugar, esse override só cria armadilha.
- **Confiança:** alta.

---

### [P1] Nenhum `not-found.tsx` / `error.tsx` / `loading.tsx` no projeto — link velho de rastreio vira 404 em inglês

- **Onde:** projeto inteiro (`find src/app -name "not-found.tsx" -o -name "error.tsx" -o -name "loading.tsx"` → 0 resultados); chamadas em `src/app/tracking/[id]/page.tsx:26,36` e `src/app/review/[token]/page.tsx:22,32`
- **O que:** Sem `not-found.tsx`, o `notFound()` cai na tela padrão do Next: fundo branco, "404 — This page could not be found." Sem `error.tsx`, qualquer exceção de servidor vira "Application error: a server-side exception has occurred". Sem `loading.tsx`, no App Router a navegação fica com a tela anterior congelada até o servidor responder — em 4G ruim isso parece app travado.
- **Como reproduzir / cenário concreto:** Cliente guarda o link `/tracking/abc123`, a entrega é excluída, ele reabre dias depois → página branca em inglês, sem logo, sem "voltar", sem telefone da loja. Mesma coisa em `/review/<token>` quando a corrida ainda não foi entregue.
- **Impacto:** Cliente final e caixa; passa impressão de site quebrado. E na tela do motoboy, sem `loading.tsx`, cada toque em "Extrato"/"Histórico" fica sem resposta visível por segundos.
- **Correção sugerida:** Criar `src/app/not-found.tsx` e `src/app/error.tsx` em PT-BR com a identidade do app, e pelo menos `loading.tsx` nas rotas pesadas (`/deliveries/history`, `/finance/extrato`, `/app`).
- **Confiança:** alta.

---

### [P1] Motoboy não tem link de navegação por corrida; a "Gerar Rota" joga fora o pino ajustado, não trava contra duplo clique e é bloqueada como pop-up

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:226-244`, `src/app/actions/logistics.ts:158-162`; grep confirma que `google.com/maps` só aparece nessa linha e não existe `waze:`/`geo:` em lugar nenhum.
- **O que:** Três problemas na única forma de navegar:
  1. **Não existe botão "Navegar" por entrega.** Pra abrir o mapa, João precisa marcar checkbox e usar "Gerar Rota" — não dá pra simplesmente tocar num endereço e ir.
  2. A URL é montada com **texto do endereço** (`destination=${p.address}`, `waypoints=...`), não com `lat/lng` — apesar de o `lat/lng` estar no banco e ter sido ajustado à mão pelo caixa no pino arrastável. O Google re-geocodifica o texto e pode mandar pra outro lugar, anulando todo o trabalho da tela de conferência.
  3. O botão **não tem estado de carregando nem trava** (`disabled` só olha `selected.length < 1`): dois toques disparam `optimizeSelectedRouteAction` duas vezes, que reescreve `stopOrder` das entregas duas vezes. E o `window.open(result.url)` acontece **depois do `await`** — o Chrome só permite abrir janela dentro de ~5s da ativação do usuário; em 4G ruim a ação demora mais que isso e o pop-up é bloqueado **sem erro nenhum na tela** (o `alert` do `else` não roda, porque `result.success` foi true).
- **Como reproduzir / cenário concreto:** João marca 4 corridas e toca "Gerar Rota" no 4G. Nada acontece. Ele toca de novo. Continua nada (ou abre uma aba). As paradas foram reordenadas duas vezes no banco.
- **Impacto:** É o caminho crítico do dia inteiro do motoboy. Entrega no endereço errado (por causa do texto) e sensação de app quebrado (por causa do pop-up silencioso).
- **Correção sugerida:** Adicionar em cada card um link direto `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` (funciona como `<a href>` normal, sem `window.open` pós-await); trocar a montagem da rota para usar `lat,lng` quando existir; e colocar `disabled`/spinner no botão durante a ação.
- **Confiança:** alta nos itens 1 e 2; média no bloqueio de pop-up (é comportamento do Chrome, não dá pra provar só lendo o código).

---

### [P1] Cerca de 200m sem saída: GPS ruim deixa o botão "Entregue" desabilitado pra sempre

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:82-97` (o `watchPosition`), `:254-257` (o cálculo), `:326-332` (o `disabled`)
- **O que:** Se `currentLocation` existir e a distância for `> 200`, o botão fica `disabled` com `cursor-not-allowed`. **Não há nenhuma forma de contornar** — nem "não estou conseguindo", nem justificativa, nem pedir liberação pra loja. E a coordenada da entrega pode estar errada de origem (o próprio app avisa "Endereço fora do raio da loja" e o `geoPrecision` pode ser só "cidade"/"bairro").
- **Como reproduzir / cenário concreto:** Prédio com laje, ou o pino veio do geocoder no centro do bairro. João está literalmente na porta do cliente, o app diz "📍 Você está a 1,4 km — chegue mais perto pra finalizar" e ele não consegue fechar a corrida. Não recebe a taxa e o dinheiro em espécie não é registrado.
- **Impacto:** Trava a operação no campo, justo quando o motoboy está com o cliente na frente. E o efeito colateral inverso também existe: quando a permissão de GPS é **negada**, `currentLocation` fica `null`, `canDeliver` cai no `true` padrão (linha 251) e a cerca simplesmente deixa de existir — sem ninguém saber.
- **Correção sugerida:** Manter o botão habilitado mas exigir confirmação extra fora do raio ("Você está a X do endereço. Finalizar mesmo assim?"), gravando essa marca junto com a entrega para a loja auditar depois. E mostrar na tela quando o GPS está desligado/negado em vez de desligar a cerca em silêncio.
- **Confiança:** alta.

---

### [P1] Primeira checagem de notificação despeja até 10 avisos velhos; depois disso ela nunca mais acha corrida nova

- **Onde:** `src/components/shared/usePushNotifications.ts:47` (`ultimaChecagem = useRef(0)`), `:61-69` (`requireInteraction: true`, `tag` único), `:126` (a chamada), `src/app/api/notifications/check/route.ts:18,24,41-46`
- **O que:** Dois defeitos ligados ao mesmo trecho:
  1. `ultimaChecagem` começa em `0` → a primeira chamada manda `lastCheck=0` → o servidor faz `gt(createdAt, "1970-01-01T…")`, o que casa com **todas** as corridas pendentes (limite 10). Cada uma vira uma `new Notification(...)` com `requireInteraction: true` (fica na tela até ser dispensada na mão), `tag` único (não colapsam) e som + vibração. Mais o extra "🔥 Várias Corridas Disponíveis!" quando são ≥3.
  2. Depois disso a comparação **nunca mais casa**: o `created_at` é gravado por `CURRENT_TIMESTAMP` no formato `'2026-08-21 16:08:38'` (confirmei lendo o `sqlite.db` local), e é comparado como texto contra `toISOString()` = `'2026-08-21T16:08:38.000Z'`. No caractere 10 tem `' '` (0x20) contra `'T'` (0x54) — o valor do banco é sempre "menor". Ou seja, corrida criada **no mesmo dia** jamais satisfaz o `gt` e o fallback de aba aberta não notifica nada.
- **Como reproduzir / cenário concreto:** João abre o app às 14h com 6 corridas pendentes na tela. 10 segundos depois o celular toca 7 vezes e enche a gaveta de notificações grudentas de corridas que ele está olhando. Às 14h05 entra corrida nova de verdade: o fallback não avisa (só o Web Push avisa, se ele tiver aceitado).
- **Impacto:** É o caminho mais curto pro motoboy desligar as notificações — e aí ele para de saber das corridas de verdade.
- **Correção sugerida:** Inicializar `ultimaChecagem.current = Date.now()` na montagem (não `0`), tirar o `requireInteraction: true` ou usar `tag` estável por entrega, e no servidor normalizar a data antes de comparar (`datetime(created_at)` no SQL em vez de comparar texto ISO com texto de espaço).
- **Confiança:** alta (formato do banco verificado no `sqlite.db`).

---

### [P1] Histórico carrega tudo sem paginação nem limite

- **Onde:** `src/app/deliveries/history/page.tsx:23-48` (três `db.select()` sem `.limit()` e sem filtro de período)
- **O que:** Motoboy busca todas as `delivered` dele; lojista, todas da loja; **admin, todas do banco**. Cada linha vira um card grande com endereço, recebimento, observação e valor.
- **Como reproduzir / cenário concreto:** Com 29 entregas/dia, em 3 meses são ~2.600 cards num único HTML. No celular do João no 4G isso é vários MB de payload e uma rolagem que trava. E não existe filtro por data nem paginação pra escapar.
- **Impacto:** A tela fica inutilizável em poucos meses de uso — e o app já está em produção há semanas, então o relógio está correndo.
- **Correção sugerida:** Paginar (`limit`/`offset` por `searchParams`) ou filtrar por mês, reaproveitando o padrão de navegação de mês que o `StatementView` já usa (`?m=&y=`).
- **Confiança:** alta.

---

### [P1] O mesmo lançamento aparece verde com "+" numa tela e vermelho com "−" na outra

- **Onde:** `src/components/dashboard/PendingConfirmations.tsx:34-35` contra `src/components/finance/StatementView.tsx:110-111`
- **O que:** No card de confirmação: `pc.type === 'debit' ? 'text-green-600' : 'text-red-600'` e `pc.type === 'debit' ? '+' : '-'`. No extrato: `isCredit ? "text-green-400" : "text-red-400"` e `isCredit ? "+" : "−"`. São regras **invertidas** para o mesmo campo.
- **Como reproduzir / cenário concreto:** A loja lança "paguei R$ 300" pedindo confirmação. João abre o app e vê no topo **"+ R$ 300,00" em verde**. Ele confirma. Vai no extrato e o mesmo lançamento aparece **"− R$ 300,00" em vermelho**.
- **Impacto:** Confusão em cima de dinheiro, na exata tela onde o motoboy dá o "aceito". Gera discussão de acerto por pura leitura errada.
- **Correção sugerida:** Usar a mesma convenção nas duas telas (a do extrato, que é a canônica) e trocar a cor/sinal do `PendingConfirmations` — ou, melhor, escrever por extenso o que o lançamento faz com o saldo ("abate R$ 300 do que a loja te deve").
- **Confiança:** alta.

---

### [P1] Botões principais do motoboy têm ~24px de altura, empilhados num canto de 360px

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:263` (o contêiner `absolute top-2 right-2 flex gap-2 flex-wrap`), `:301` (Aceitar), `:314` (Peguei), `:327` (Entregue), `:343` (Editar), `:355` (Excluir)
- **O que:** Todos usam `p-1 px-2 text-xs` → 4px + ~16px de linha + 4px ≈ **24px de altura**, contra os 44-48px recomendados pra toque. Ficam num overlay absoluto no canto superior direito, colados uns nos outros (`gap-2`), junto com o badge de status e o botão WhatsApp. Em 360px o `flex-wrap` quebra em duas ou três linhas, e o conteúdo do card é empurrado por `mt-8` / `mr-12` chutados na mão (`:363`, `:375`) — se a barra quebrar em três linhas, ela **cobre o nome do cliente**.
- **Como reproduzir / cenário concreto:** Celular de 360px, corrida com telefone do cliente e status "Em Rota": aparecem badge + WhatsApp + Entregue lado a lado; o botão de 24px "Entregue" fica a poucos pixels do "WhatsApp". João de capacete, com a mão suada, toca em WhatsApp por engano — abre outro app e ele perde o fluxo.
- **Impacto:** É o botão mais usado do produto. Erro de toque custa tempo em cima da moto.
- **Correção sugerida:** Tirar os botões do overlay absoluto e colocá-los numa linha de ações abaixo do endereço, com `min-h-11` (44px) e o botão principal ocupando a largura toda; deixar o WhatsApp separado dos botões de estado.
- **Confiança:** alta.

---

### [P1] O service worker só é registrado se o usuário aceitar notificações, e não tem `fetch` — logo offline e "instalar app" nunca funcionam

- **Onde:** `src/components/shared/usePushNotifications.ts:75-76,88` (único `serviceWorker.register` do projeto, atrás de `if (permissao !== "granted") return`), `public/sw.js` (só `install`, `activate`, `push`, `notificationclick` — **nenhum `fetch`**), `src/components/shared/InstallPrompt.tsx:16` (`beforeinstallprompt`), `package.json:"next-pwa"` (dependência instalada mas nunca usada — `next.config.ts` não a importa)
- **O que:** Três consequências:
  1. Quem toca em "Depois" no convite de avisos **nunca ganha service worker**. E o hook só é montado em `/app` (`FirstRunWrapper`), então em nenhuma outra rota ele é registrado.
  2. Sem `fetch` handler, não há cache nenhum: toda navegação depende da rede. Erro de rede = página de erro do Chrome dentro do TWA em tela cheia, sem barra de endereço pra recarregar.
  3. Sem `fetch` handler o Chrome não considera o site instalável → `beforeinstallprompt` não dispara → o `InstallPrompt` do layout é código morto, e o conselho "Instale o app na tela inicial" (`usePushNotifications.ts:80`) não tem como ser seguido.
- **Como reproduzir / cenário concreto:** João entra no elevador de um prédio, o 4G cai, ele toca em "Histórico" → tela de erro do Chrome sem nada em volta. Fora isso, nunca aparece o convite de instalação no navegador (o APK do TWA salva o caso dele, mas não o do lojista no Edge).
- **Impacto:** O app se apresenta como PWA offline-capaz e não é nenhuma das duas coisas.
- **Correção sugerida:** Registrar o SW no carregamento do app (fora do fluxo de permissão de notificação) e adicionar um `fetch` handler: network-first com fallback de cache pra HTML, cache-first pra `/_next/static`, e uma página `offline.html` mínima.
- **Confiança:** alta.

---

### [P2] Todo erro de servidor no fluxo do motoboy vira `alert()` do navegador

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:123,128,141,146,165,170,188,193,236` (9 ocorrências)
- **O que:** Aceitar, Coletar, Finalizar, Excluir e Gerar Rota reportam falha com `alert(...)`. No TWA em tela cheia o Android mostra a caixa cinza "zapentregas.duckdns.org diz:", que quebra a ilusão de app nativo, bloqueia a thread e some sem deixar registro.
- **Impacto:** Aparência amadora exatamente nos momentos de erro, que já são os piores.
- **Correção sugerida:** Trocar por um toast/faixa inline no card da entrega — o projeto já tem esse padrão em `FirstRunPrompts.tsx:81-97`.
- **Confiança:** alta.

### [P2] Toda ação bem-sucedida faz `window.location.reload()`

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:125,143,167,190`
- **O que:** Depois de aceitar/coletar/finalizar/excluir, a página inteira recarrega do zero (novo request de HTML + JS), em vez de `router.refresh()`, que só refaz o render do servidor.
- **Impacto:** Em 4G ruim, cada corrida fechada custa 3-6 segundos de tela em branco e a posição de rolagem é perdida — em 29 entregas/dia isso vira minutos parados.
- **Correção sugerida:** `router.refresh()` (o `RefreshButton.tsx:13` já usa) — as actions já chamam `revalidatePath("/app")`.
- **Confiança:** alta.

### [P2] `/confirmar/<token>` não avisa o PDV quando o link é inválido/expirado, e promete fechar uma janela que não fecha dentro do iframe

- **Onde:** `src/app/confirmar/[token]/page.tsx:27-44` e `:90-99` (o componente `Recado`), `src/components/deliveries/DraftConfirmForm.tsx:85-92` e `:164`
- **O que:** No caminho feliz o `encerrarPeloPdv` faz `postMessage` e depois `window.close()` — que é **no-op dentro de um iframe** (só funciona em janela aberta por script). O texto diz "Pode voltar pra venda — esta janela fecha sozinha", o que não acontece; quem tem que fechar o iframe é o PDV, reagindo ao `postMessage`. Já no caminho de erro (`Recado`), **nenhum `postMessage` é enviado**: o PDV fica sem saber que o token venceu, e a mensagem diz "Pode fechar esta janela" — algo que o caixa não tem como fazer dentro de um iframe.
- **Como reproduzir / cenário concreto:** O caixa deixa a venda aberta mais de 2h, volta e clica em conferir → o iframe mostra "Link expirado / Pode fechar esta janela" e trava ali; o PDV não recebe evento nenhum e o caixa não tem botão pra sair.
- **Impacto:** Caixa preso na tela, corrida em `draft` esquecida — e essa corrida é invisível pro motoboy.
- **Correção sugerida:** Emitir `postMessage({ tipo: "zap-entregas:conferencia", resultado: "expirado" | "invalido" })` também nos casos de erro, e ajustar a cópia para "Pode fechar esta janela / voltar pra venda" só quando `window.parent === window`.
- **Confiança:** alta (o `postMessage` de erro simplesmente não existe no arquivo).

### [P2] `LocationTracker` manda a posição pro servidor a cada leitura do GPS, sem intervalo

- **Onde:** `src/components/map/LocationTracker.tsx:17-32` (`watchPosition` com `enableHighAccuracy: true`, `maximumAge: 0`, e `await updateLocationAction(...)` **dentro do callback**, sem throttle)
- **O que:** Com alta precisão o Android dispara o callback de 1 em 1 segundo. Cada disparo é um POST de server action.
- **Impacto:** Bateria e dado do motoboy (plano pago). Numa jornada de 8h são dezenas de milhares de requisições. Também bate no servidor sem necessidade — a posição pro rastreio não precisa de 1Hz.
- **Correção sugerida:** Enviar no máximo a cada 15-30s (guardar o último envio numa `ref`) e usar `maximumAge` maior; considerar desligar o `watch` quando `document.hidden`.
- **Confiança:** alta.

### [P2] GPS negado/desligado não gera nenhum aviso na tela

- **Onde:** `src/components/deliveries/PendingDeliveriesForm.tsx:92` (`(error) => console.error("Error getting location", error)`), `src/components/map/LocationTracker.tsx:23-26` + `:37` (`if (status === "error") return null`)
- **O que:** Nos dois componentes o erro de geolocalização só vai pro console. O `LocationTracker` chega a esconder o próprio indicador "GPS Ativo" quando falha — ou seja, o sinal de que algo deu errado é a **ausência** de um badge que o usuário talvez nunca tenha visto.
- **Impacto:** João acha que o rastreio está funcionando e a loja não o vê no mapa; e a cerca de 200m se desliga sem ninguém perceber (ver P1 acima).
- **Correção sugerida:** Mostrar uma faixa "Localização desligada — a loja não consegue te acompanhar e você não vai conseguir finalizar entrega pelo mapa", com instrução de como liberar (o projeto já faz isso muito bem pra notificação em `FirstRunPrompts.tsx:60-76`).
- **Confiança:** alta.

### [P2] Zoom bloqueado e `viewport-fit: cover` sem respeitar a área segura

- **Onde:** `src/app/layout.js:20-27`
- **O que:** `maximumScale: 1` + `userScalable: false` impedem o pinça-pra-zoom (contraria a WCAG 1.4.4). E `viewportFit: "cover"` faz o conteúdo ir até as bordas físicas, mas **não existe nenhum `env(safe-area-inset-*)` no projeto** (grep sem resultado) — o header `sticky top-0` de `/app`, `/deliveries/history` etc. pode ficar parcialmente sob a barra de status no TWA em tela cheia.
- **Impacto:** Motoboy no sol não consegue ampliar um endereço pequeno; e o topo das telas encosta nos elementos do sistema.
- **Correção sugerida:** Remover `maximumScale`/`userScalable`; adicionar `padding-top: env(safe-area-inset-top)` no header e `padding-bottom: env(safe-area-inset-bottom)` no `pb-20` das páginas.
- **Confiança:** alta.

### [P2] Campos de telefone sem teclado numérico e sem autocomplete

- **Onde:** `src/app/login/LoginForm.tsx:106-112` (`type="text"`, sem `inputMode`, sem `autoComplete`), `src/app/routes/new/page.tsx:87-91`, `src/components/deliveries/DraftConfirmForm.tsx:220-225` (tem `inputMode="tel"` mas sem máscara)
- **O que:** No login o campo de celular é `type="text"` puro: o Android abre o teclado QWERTY e o gerenciador de senhas do Chrome não reconhece o par usuário/senha (falta `autoComplete="tel"` / `"current-password"`).
- **Impacto:** Atrito em toda entrada de sessão nova — que acontece toda vez que o motoboy troca de aparelho ou limpa dados. Compare com `completar-cadastro/CompleteProfileForm.tsx:31-32`, que faz certo (`type="tel" inputMode="numeric"`).
- **Correção sugerida:** `type="tel" inputMode="numeric" autoComplete="tel"` no login/cadastro e `autoComplete="current-password"` na senha.
- **Confiança:** alta.

### [P2] Datas em duas telas saem sem fuso e podem cair um dia antes

- **Onde:** `src/app/finance/manager/page.tsx:111` (`new Date(record.dueDate).toLocaleDateString('pt-BR')`), `src/app/admin/users/[id]/page.tsx:122,127`
- **O que:** São os únicos lugares que não usam o `src/lib/datetime.ts`. `financial_records.due_date` é `text` (`schema.ts:118`); se vier como `"2026-09-10"`, `new Date()` interpreta como meia-noite **UTC** e o `toLocaleDateString` renderiza no fuso do navegador → em Brasília (UTC−3) vira 09/09. Em `admin/users`, o `createdAt` vem no formato `'2026-08-21 16:08:38'` (verificado no `sqlite.db`), que o V8 lê como hora local, deslocando 3h.
- **Impacto:** Vencimento de conta mostrado um dia antes no financeiro do lojista; datas de cadastro erradas no painel admin.
- **Correção sugerida:** Trocar os três pontos por `fmtDate(...)` de `@/lib/datetime` — a função já existe e já cuida do "Z" que falta e do `America/Sao_Paulo`.
- **Confiança:** alta no `admin/users`; média no `dueDate` (depende do formato exato que o insert grava, não confirmei o valor real).

### [P2] Notificação push mostra dinheiro com ponto: "R$ 25.00"

- **Onde:** `src/app/api/notifications/check/route.ts:32-33`; padrão parecido em `src/app/admin/page.tsx:323` e `src/app/admin/users/[id]/page.tsx:236`
- **O que:** `delivery.value.toFixed(2)` sem `.replace('.', ',')` nem `toLocaleString('pt-BR')`.
- **Impacto:** O corpo da notificação que o motoboy lê na tela de bloqueio sai "Rua X — R$ 180.00 (ganho: R$ 8.00)". Feio e, num relance, ambíguo.
- **Correção sugerida:** Usar `formatBRL` de `@/lib/wallet-shared` (já existe e usa `toLocaleString('pt-BR', { style: 'currency' })`).
- **Confiança:** alta.

### [P2] `ConfirmationModal` fecha antes da ação terminar e não responde a Esc, toque no fundo ou botão Voltar

- **Onde:** `src/components/shared/ConfirmationModal.tsx:58-62` (`onConfirm(); handleClose();` sem `await`), `:73-74` (o backdrop não tem `onClick`, não há listener de `keydown` nem prisão de foco)
- **O que:** Ao confirmar uma exclusão, o modal some na hora e a `deleteDeliveryAction` continua rodando em segundo plano — se falhar, o `alert` aparece do nada, sem contexto. E o único jeito de sair é o X (que também não tem `aria-label`); no Android o botão Voltar navega pra fora da página em vez de fechar o modal.
- **Impacto:** Lojista fica sem saber se a exclusão pegou; navegação inesperada no celular.
- **Correção sugerida:** Tornar `handleConfirm` assíncrono com estado de "excluindo…", fechar só no sucesso; adicionar `onClick` no backdrop, listener de Escape e `aria-modal`.
- **Confiança:** alta.

### [P2] `ApiKeyForm` engole o erro do servidor

- **Onde:** `src/components/admin/ApiKeyForm.tsx:24-30`
- **O que:** `if (result.success && result.apiKey) { ... }` — sem `else`. Se a action devolver `{ error }`, **nada acontece na tela**: o spinner some e o botão volta ao normal.
- **Como reproduzir / cenário concreto:** Lojista toca "Gerar API Key", a action falha, ele toca de novo, de novo, e conclui que o app está quebrado.
- **Correção sugerida:** Guardar o erro em estado e mostrar a faixa vermelha que o componente já sabe desenhar em outro contexto.
- **Confiança:** alta.

### [P2] Histórico do motoboy esconde endereço e telefone mas continua mostrando o valor do pedido

- **Onde:** `src/app/deliveries/history/page.tsx:50-57` (a máscara LGPD não toca em `value`) e `:134` (renderiza `item.value`), contra `src/app/app/page.tsx:25-42` (`applyVisibility` zera `value` quando `showOrderValue` é falso)
- **O que:** No painel, o valor do pedido é escondido do motoboy conforme a configuração da loja. No histórico, o mesmo campo é exibido sem passar por nenhum filtro.
- **Impacto:** A configuração "não mostrar valor do pedido pro motoboy" só vale em metade do app — a loja acha que escondeu e não escondeu.
- **Correção sugerida:** Aplicar a mesma regra de visibilidade no histórico, ou omitir o bloco "Valor" quando `role === 'motoboy'`.
- **Confiança:** alta.

### [P2] Rastreio público não atualiza sozinho e promete "15-20 min" mesmo sem motoboy

- **Onde:** `src/app/tracking/[id]/page.tsx` (componente de servidor puro, sem `revalidate`, sem polling, sem client component que recarregue) e `:71`
- **O que:** A página é renderizada uma vez e congela. O cliente precisa puxar pra recarregar pra saber que o motoboy saiu. E a linha `: "Previsão: 15-20 min"` é o `else` de todos os status que não são `delivered`/`canceled` — inclusive `pending`, quando **nenhum motoboy aceitou ainda**.
- **Impacto:** O link de rastreio não rastreia. O cliente lê "Previsão 15-20 min" numa corrida que ninguém pegou, e cobra a loja pelo atraso.
- **Correção sugerida:** `export const revalidate = 15` + um pequeno client component que chama `router.refresh()` a cada 20-30s (parando quando `document.hidden`); e só mostrar previsão a partir de `picked_up`.
- **Confiança:** alta.

### [P2] Mapa do Google com `gestureHandling: "greedy"` prende a rolagem da página

- **Onde:** `src/components/map/GooglePinPicker.tsx:58`
- **O que:** `greedy` faz o mapa capturar arrasto de um dedo só. Num formulário de celular com o mapa de 300px no meio (`DraftConfirmForm.tsx:199-207`), o dedo que cair sobre o mapa pan-eia o mapa em vez de rolar a página.
- **Impacto:** O caixa/lojista tem que achar a faixinha lateral pra passar do mapa e chegar nos campos de valor e taxa embaixo.
- **Correção sugerida:** Usar `"cooperative"` (dois dedos pra mexer no mapa) ou deixar `greedy` só quando a página não rola.
- **Confiança:** média (é comportamento conhecido da API do Google, mas não testei nesta tela).

---

### [P3] Ilhas claras num app escuro

- **Onde:** `src/app/finance/new/page.tsx:32`, `src/app/finance/manager/page.tsx:25`, `src/app/motoboys/[id]/page.tsx:27`, `src/app/security/2fa-setup/page.tsx:99`, `src/components/shared/ConfirmationModal.tsx:74`, `src/components/deliveries/CompleteDeliveryModal.tsx:66`, `src/components/dashboard/PendingConfirmations.tsx:19`, `src/components/shared/RefreshButton.tsx:20` (botão branco sobre fundo `zinc-900`)
- **O que:** O app é `bg-zinc-900` em quase tudo, mas essas telas e modais são brancas/claras. Não quebra nada (todas têm cor de texto explícita), mas pisca na cara do usuário ao navegar.
- **Correção sugerida:** Padronizar essas telas no tema escuro num passe de UI.
- **Confiança:** alta.

### [P3] `manifest.json` abre na landing, não no app

- **Onde:** `public/manifest.json:8` (`"start_url": "/"`) contra `:45` (o atalho aponta pra `/app`) e `src/app/page.tsx:209-210` (`/` redireciona logado pra `/app`)
- **O que:** Toda abertura do app instalado paga um redirect a mais; deslogado, cai na landing de marketing (que ainda baixa Google Fonts em runtime — `page.tsx:214-218`).
- **Correção sugerida:** `"start_url": "/app"`.
- **Confiança:** alta.

### [P3] Só três páginas têm `metadata` própria

- **Onde:** `src/app/layout.js:14`, `src/app/page.tsx:5`, `src/app/privacidade/page.tsx:5` — nenhuma outra rota exporta `metadata`.
- **O que:** Todas as demais herdam o título "Zap Entregas". Com o lojista no Edge com várias abas, não dá pra distinguir "Histórico" de "Financeiro". Bônus: `page.tsx:10` põe `themeColor` dentro de `metadata`, onde o Next 15+ ignora (o certo é o export `viewport`).
- **Correção sugerida:** `export const metadata = { title: "..." }` nas rotas principais.
- **Confiança:** alta.

### [P3] Valores crus do banco aparecendo na tela

- **Onde:** `src/app/deliveries/history/page.tsx:118-119` (`(${item.receivedMethod})` → "(cartao)", "(pix)"), `:134` (valor sem "R$"), `src/components/deliveries/PendingDeliveriesForm.tsx:272` (fallback que imprime `delivery.status` cru)
- **O que:** "cartao" sem cedilha, "pix" minúsculo, e um `else` que mostraria `delivered`/`canceled` em inglês se o status escapasse do mapeamento. O valor no histórico usa `toLocaleString` sem `style: 'currency'`, saindo "180,00" sem o "R$" (embora o rótulo acima diga "Valor").
- **Correção sugerida:** Um mapa `METHOD_LABEL` como já existe o `STATUS_LABEL` em `tracking/[id]/page.tsx:12-19`, e `formatBRL` no valor.
- **Confiança:** alta.

### [P3] Acessibilidade básica: 4 `aria-label` no projeto inteiro

- **Onde:** `src/components/shared/ConfirmationModal.tsx:81` e `src/components/deliveries/CompleteDeliveryModal.tsx:72` (X de fechar sem rótulo), `src/app/finance/manager/page.tsx:148` (botão de lixeira só com ícone), `src/components/map/AddressAutocomplete.tsx:244` (X de limpar), `src/app/tracking/[id]/page.tsx:125` (`<img>` sem `alt`)
- **O que:** `grep -c aria-label src/` devolve 4. Muitos botões de ícone se apoiam só em `title`, que no celular não existe.
- **Correção sugerida:** `aria-label` nos botões de ícone e `alt` nas imagens.
- **Confiança:** alta.

### [P3] Contraste ruim no botão amarelo de "warning"

- **Onde:** `src/components/shared/ConfirmationModal.tsx:67` (`bg-yellow-500 hover:bg-yellow-600 text-white`)
- **O que:** Branco sobre `#eab308` dá contraste em torno de 1,9:1 — bem abaixo do mínimo 4,5:1. Esse é o variant **padrão** dos modais disparados pelo `PendingDeliveriesForm.tsx:114`.
- **Correção sugerida:** `text-yellow-950` (ou `text-black`) sobre o amarelo.
- **Confiança:** alta.

### [P3] Código morto e dependências penduradas

- **Onde:** `src/components/billing/AdBanner.tsx:61-87` (`InlineAd`, exportado e nunca importado — grep só acha a definição; tem anúncios falsos com `link: "#"`), `package.json` (`next-pwa` instalado e nunca referenciado no `next.config.ts`), `src/app/actions/logistics.ts:431` (`NEXT_PUBLIC_BASE_URL` numa server action: o Next inlina `NEXT_PUBLIC_*` no build, então em produção sempre cai no fallback fixo — funciona por sorte, mas contraria a regra do projeto de ler ambiente em runtime), `src/app/actions/logistics.ts:437-439` (a action devolve `reviewUrl`/`customerPhone`, mas `PendingDeliveriesForm.tsx:187-191` ignora e só recarrega — o link de avaliação nunca chega no cliente).
- **Correção sugerida:** Remover o `InlineAd` e o `next-pwa`; trocar `NEXT_PUBLIC_BASE_URL` por `absoluteUrl()` de `@/lib/appUrl`; e ou usar o `reviewUrl` (abrindo o WhatsApp após finalizar) ou parar de devolvê-lo.
- **Confiança:** alta.

---

## Coisas verificadas e OK (pra não re-auditar)

- **Inputs e texto invisível:** varri todos os `<input>/<select>/<textarea>` do projeto com script — **todos** têm cor de texto explícita (`text-white`, `text-zinc-900`, `text-gray-900`). O único `type="date"` (`finance/manager/new/page.tsx:72`) tem `text-zinc-900`. O problema do `--foreground` sobreviveu só em texto solto (ver P1 do rastreio), não em campos.
- **Fallback do mapa:** `googleMapsLoader.ts:105` engancha `window.gm_authFailure`, que é o que o Google chama em `RefererNotAllowedMapError`/`InvalidKeyMapError`; `marcarRecusa()` avisa todos os mapas da página e `PinPicker.tsx:39` cai no Leaflet. Tem também `onerror` de rede (`:140`) e timeout de 10s (`:107`). Dentro do iframe do PDV o referrer da requisição é o do próprio Zap, então a restrição `https://zapentregas.duckdns.org/*` casa. Bem resolvido.
- **Pino arrastável no touch:** tanto o Google (`GooglePinPicker.tsx:61-78`, `draggable` + `click` no mapa) quanto o Leaflet (`LeafletPinPicker.tsx:35-40,75-81`) aceitam arrastar **e** tocar pra mover — o toque é o caminho fácil no celular.
- **Aviso de precisão do geocode:** `DraftConfirmForm.tsx:96-107` tem mensagens distintas e claras por `geoPrecision` (cidade / bairro / rua) e por endereço longe da loja. Excelente.
- **`/confirmar` no iframe:** não tem menu, não tem link pra `/login`, não mostra saldo nem outras entregas; CSP de `frame-ancestors` vem do `proxy.ts:17-22` lido em runtime.
- **"Esqueci minha senha" sem SMTP:** `login/forgot-password/page.tsx` é honesta — diz que não manda e-mail e explica que quem destrava é a loja. Nenhuma promessa falsa.
- **`FirstRunPrompts`/`PasskeyInvite` não entram em loop:** o convite de aviso só aparece com `permissao === "default"` e respeita um adiamento de 24h em `localStorage` (`usePushNotifications.ts:18-34,163`); a digital só entra depois que o de notificação sai da frente (`FirstRunPrompts.tsx:79`).
- **Permissão de notificação:** pedida por botão explícito, nunca no carregamento (`usePushNotifications.ts:140-148`), com instrução detalhada de como reverter quando negada (`FirstRunPrompts.tsx:60-76`).
- **"Entrar com Google" e "Entrar com digital":** o Google é escondido quando não configurado (`LoginForm.tsx:152`), e a digital detecta suporte (`PasskeyLoginButton.tsx:22`) e dá recado útil para `NotAllowedError`.
- **Fontes:** o app usa `next/font/google` (`layout.js:4-12`), que baixa e auto-hospeda no build — não depende do Google em runtime. Só a landing pública (`page.tsx:214-218`) puxa Google Fonts, com `display=swap` e fallback de sistema.
- **Datas:** `src/lib/datetime.ts` está correto (marca o "Z" que falta e força `America/Sao_Paulo`) e é usado em `history`, `StatementView`, `DraftsBanner`, `PendingConfirmations`, `deliveries/[id]/confirmar`. As duas exceções estão reportadas em P2.
- **Dinheiro:** `formatBRL` (`wallet-shared.ts:30`) usa `toLocaleString('pt-BR', { style: 'currency' })`; os `toFixed(2).replace('.', ',')` espalhados produzem vírgula certa (só falta separador de milhar). As exceções sem `replace` estão em P2/P3.
- **Tabelas em telas estreitas:** as duas únicas (`admin/page.tsx:355`, `admin/users/page.tsx:140`) estão dentro de `overflow-x-auto`. Nenhuma página tem rolagem horizontal por tabela.
- **`AdBanner` não cobre mais botão:** foi convertido de `fixed` pra fluxo normal (`AdBanner.tsx:17-24`), com comentário explicando o bug antigo. O `pb-20 md:pb-8` das páginas dá folga pro rodapé.
- **Guarda de rota em página de cliente:** `routes/new` é `"use client"` mas está protegida pelo `layout.tsx:12` (`requireShopkeeper`), com comentário explicando por quê.
- **`lang="pt-BR"`** no `<html>` (`layout.js:34`), `manifest.json` com `lang`, `dir`, ícone maskable e badge monocromático — a parte de ícones do PWA está bem feita.
- **Nenhum `"use client"` importando o `db`:** conferi os componentes de cliente grandes (`PendingDeliveriesForm`, `DraftConfirmForm`, `LoginForm`, `ManualEntryForm`) — todos recebem dados por prop ou por server action.
- **Status em PT-BR pro cliente:** `tracking/[id]/page.tsx:12-19` tem um `STATUS_LABEL` completo, com comentário dizendo explicitamente "nada de status cru em inglês".

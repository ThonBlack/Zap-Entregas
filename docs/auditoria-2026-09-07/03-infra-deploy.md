# Infra, Deploy, Operação e PWA/Android — achados

## Resumo (3-6 linhas)

O serviço está **de pé e saudável agora**: container `zap-entregas` no ar há 23h, `RestartCount=0`, sem OOM, 140 MB de RAM, nenhum 5xx atribuível ao Zap nas últimas 48h, HTTPS com redirect 80→443, `proxy_pass 127.0.0.1` (o fix de 06/09 está de fato aplicado — confirmei no arquivo e no `error.log`, onde os erros `[::1]:4000` param às 11:22 de 06/09), assetlinks servindo o fingerprint certo, backup diário do banco funcionando com `VACUUM INTO` e integridade `ok`.

O problema mais grave não é de disponibilidade: **a chave de assinatura do app Android e o arquivo com a senha dela estão dentro da imagem Docker que roda em produção** (`/app/android/zapentregas.keystore`), porque o `.dockerignore` não exclui `android/`. Perder ou vazar essa chave significa nunca mais conseguir atualizar o app publicado.

Depois disso, a maior dívida é **deriva entre o que está no repositório e o que está na VPS**: o `docker-compose.yml` do repo perdeu 6 variáveis que existem só no servidor (push, iframe do PDV, assetlinks) e ainda abre a porta 4000 pra internet; o `deploy.sh` e o README descrevem um processo de deploy que não é mais o real e que, se rodado, tentaria buildar na VPS de 3,8 GB. Somam-se: container sem limite de memória (todos os vizinhos têm), sem healthcheck, sem rotação de log do Docker, upload de avatar que quebra acima de 1 MB por limite do Next, e o backup que mora no mesmo disco da máquina que ele protege.

---

## Achados

### [P0] Chave de assinatura do app Android (e a senha dela) vão dentro da imagem de produção
- **Onde:** `D:\Zap-Entregas\.dockerignore` (lista inteira — não tem `android`), `D:\Zap-Entregas\Dockerfile:10` (`COPY . .`), `D:\Zap-Entregas\android\zapentregas.keystore`, `D:\Zap-Entregas\android\keystore-password.txt`
- **O que:** O `.dockerignore` exclui `node_modules`, `.next`, `.git`, `.env*`, `docs`, `uploads`, `sqlite.db`… mas **não exclui `android/`**. Como o Dockerfile faz `COPY . .`, os 6,8 MB da pasta `android/` entram na imagem — incluindo o keystore de assinatura do app publicado, o arquivo `keystore-password.txt` com a senha em texto puro, e os `.apk`/`.aab` assinados.
- **Como reproduzir / cenário concreto:** Confirmado na VPS, em produção:
  ```
  $ docker exec zap-entregas ls -la /app/android
  -rwxr-xr-x 1 root root      25 keystore-password.txt
  -rwxr-xr-x 1 root root    2754 zapentregas.keystore
  -rwxr-xr-x 1 root root 2215669 app-release-signed.apk
  ```
  Qualquer pessoa que consiga executar comando dentro do container, ou que receba um `docker save` da imagem (que é exatamente como o deploy funciona — a imagem viaja pela rede), sai com a chave e a senha.
- **Impacto:** É a chave que prova ao Android que uma atualização do app vem do dono legítimo. Vazada, alguém assina um APK falso "Zap Entregas" que os motoboys instalam por cima do verdadeiro. Perdida, não existe forma de atualizar o app já instalado — só publicar um app novo, com outro pacote, e pedir pra todo mundo reinstalar. O keystore está corretamente fora do git (`.gitignore` linha final: `/android/`), o que mostra que a intenção era protegê-lo; só faltou repetir a regra no `.dockerignore`.
- **Correção sugerida:** Acrescentar `android` (e `*.keystore`, `*.apk`, `*.aab`, `keystore-password.txt`) ao `.dockerignore` e rebuildar. Guardar o keystore fora da pasta do projeto, num cofre. Considerar a chave como potencialmente comprometida se a imagem já circulou fora da sua máquina/VPS.
- **Confiança:** alta (confirmado por `docker exec ls` no container de produção).

---

### [P1] `docker-compose.yml` do repositório está defasado: faltam 6 variáveis e a porta fica exposta
- **Onde:** `D:\Zap-Entregas\docker-compose.yml` (arquivo inteiro) vs `/opt/zap-entregas/docker-compose.yml` na VPS
- **O que:** O compose do repo **não repassa** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PDV_FRAME_ANCESTORS`, `ANDROID_PACKAGE_NAME`, `ANDROID_CERT_FINGERPRINTS` — todas as seis existem no compose da VPS e no `.env` de produção. Além disso usa `build: .` (que não é mais o processo) e `ports: "4000:3000"` **sem** o `127.0.0.1:` que a VPS tem.
- **Como reproduzir / cenário concreto:** Subir o serviço com o compose que está no git → o container sobe sem as VAPID (notificação push para de sair, `web-push` falha), `/.well-known/assetlinks.json` passa a responder `[]` (o app Android abre com a barra de endereço do Chrome à mostra), o `/confirmar/<token>` ganha `frame-ancestors 'self'` e o PDV do EpicStore não consegue mais embutir o iframe do caixa. E `ports: "4000:3000"` publica em `0.0.0.0` — o Docker escreve direto no `iptables` e **fura o UFW**, deixando a porta 4000 acessível da internet sem TLS.
- **Impacto:** Um deploy feito "do jeito documentado" quebra push, app Android e a conferência do caixa de uma vez, e expõe o app sem HTTPS. É a receita para um domingo à noite ruim.
- **Correção sugerida:** Trazer o compose da VPS para o repositório como fonte única da verdade (com `image: zap-entregas:prod` e `127.0.0.1:4000:3000`), e criar um `.env.example` listando as 22 chaves esperadas.
- **Confiança:** alta (comparei os dois arquivos linha a linha; `ufw status` mostra que a 4000 não está liberada, ou seja, hoje a proteção vem só do `127.0.0.1` do compose da VPS).

---

### [P1] Deploy documentado (`deploy.sh` + README) não é o deploy real e é destrutivo se rodado
- **Onde:** `D:\Zap-Entregas\scripts\deploy\deploy.sh:3` (`APP_DIR="/var/www/zap-entregas"`), `:20-25` (`git clone` / `git pull`), `:38` (`docker compose up -d --build`); `D:\Zap-Entregas\README.md` seção "Docker (Produção)" (`docker compose up -d --build`)
- **O que:** O deploy real é: build na máquina do Thon → `docker save | gzip | ssh | docker load` → `docker compose up -d` sem build, com tag `zap-entregas:rollback` guardada. Isso não está escrito em lugar nenhum. O que está escrito aponta para `/var/www/zap-entregas` (pasta que **não existe** na VPS — o app mora em `/opt/zap-entregas`) e manda buildar no servidor.
- **Como reproduzir / cenário concreto:** Rodar `scripts/deploy/deploy.sh` na VPS → ele faz `git clone` em `/var/www/zap-entregas`, e roda `docker compose up -d --build` lá. O build do Next em 3,8 GB de RAM com 14 containers rodando muito provavelmente estoura a memória; e como o compose do repo tem `container_name: zap-entregas`, o Compose **remove o container de produção** para criar o novo. Se o build falhar depois disso, o app fica fora do ar sem container para voltar.
- **Impacto:** Perda de serviço num momento em que a pessoa achava que estava seguindo o procedimento oficial.
- **Correção sugerida:** Reescrever `deploy.sh` com o fluxo real (build local, save/load, tag de rollback, `up -d --no-build`) ou apagá-lo, e corrigir a seção de deploy do README.
- **Confiança:** alta (li o script; confirmei na VPS que `/var/www/zap-entregas` não existe e que a imagem `zap-entregas:rollback` de 9 dias atrás existe, provando qual é o fluxo real).

---

### [P1] Upload de avatar acima de 1 MB falha — o código valida 5 MB, o Next corta em 1 MB
- **Onde:** `D:\Zap-Entregas\src\lib\upload.ts:5` (`MAX_UPLOAD_BYTES = 5 * 1024 * 1024`), `src\app\actions\motoboy.ts:23` e `:34`, `src\app\actions\settings.ts:12`, `D:\Zap-Entregas\next.config.ts` (não define `experimental.serverActions.bodySizeLimit`)
- **O que:** O envio de foto é feito por Server Action (`"use server"` + `FormData` com `File`, `motoboy.ts:1,96,102`). O limite padrão de corpo de Server Action no Next é **1 MB**. Como `next.config.ts` não sobrescreve `bodySizeLimit`, qualquer foto entre 1 MB e 5 MB é rejeitada pelo framework antes de a validação de 5 MB do código rodar.
- **Como reproduzir / cenário concreto:** Cadastrar motoboy com foto de celular (tipicamente 2–4 MB) em `/motoboys/novo` → a action falha com "Body exceeded 1 MB limit"; a tela mostra erro genérico, não "Imagem maior que 5MB". A mensagem que o usuário vê ("imagem até 5MB") mente.
- **Impacto:** Lojista tenta pôr a foto do motoboy tirada no celular e não consegue, sem entender por quê. O `client_max_body_size 500M` do nginx não protege disso — o gargalo é o Next.
- **Correção sugerida:** Definir `experimental: { serverActions: { bodySizeLimit: '6mb' } }` em `next.config.ts`, ou comprimir a imagem no navegador antes de enviar.
- **Confiança:** alta no código (li as três linhas); média na reprodução — não testei o envio real de um arquivo de 3 MB em produção.

---

### [P1] Container do Zap é o único sem limite de memória, numa VPS de 3,8 GB já sob pressão
- **Onde:** `D:\Zap-Entregas\docker-compose.yml` (sem `deploy.resources` / `mem_limit`); confirmado com `docker inspect zap-entregas` → `Memory=0 MemSwap=0 CPUs=0 PidsLimit=null`
- **O que:** Todo container vizinho na VPS tem teto (`epicstore-app` 1 GiB, `epicstore-db` 512 MiB, `epicgestor-api` 768 MiB, `epichub-app` 768 MiB…). O `zap-entregas` aparece no `docker stats` como `139.9MiB / 3.823GiB` — ou seja, teto = a máquina inteira.
- **Como reproduzir / cenário concreto:** Um vazamento de memória, um `geocode` em massa ou um `app_logs` gigante no Next fazem o processo crescer; sem `mem_limit`, o kernel escolhe a vítima do OOM entre **todos** os containers. O Postgres do EpicStore ou o EpicGestor (produção de outros clientes) podem morrer por causa do Zap. A memória livre agora é 490 MB, com 652 MB já em swap.
- **Impacto:** Um problema no Zap derruba serviços que não têm nada a ver com ele.
- **Correção sugerida:** Acrescentar `mem_limit: 512m` (ou 768m) e `cpus: "0.5"` ao serviço no compose, como já é o padrão dos outros projetos da VPS.
- **Confiança:** alta.

---

### [P1] Backup do banco existe e funciona, mas fica no mesmo disco da VPS — não há cópia fora
- **Onde:** `/opt/backups/backup-epiccorp.sh:21` (`sqlite3 /opt/zap-entregas/sqlite.db "VACUUM INTO ..."`), `crontab -l` linha `15 3 * * * /opt/backups/backup-epiccorp.sh`
- **O que:** O backup diário roda às 03h15, usa `VACUUM INTO` (consistente, não é `cp` de arquivo aberto), comprime e guarda 15 dias em `/opt/backups/zap-entregas/`. Está tudo certo — só que `/opt/backups` está no **mesmo `/dev/sda1`** do `/opt/zap-entregas`. Não encontrei nenhum `rsync`/`scp` em `crontab -l`, `/etc/cron.d/` ou `/var/spool/cron/crontabs/` que leve esses arquivos pra fora.
- **Como reproduzir / cenário concreto:** Disco corrompido, VPS deletada ou conta suspensa na Hostinger → o banco e os 15 backups vão juntos. Os únicos "backups" fora são os `sqlite.db.bak-*` manuais, que também estão em `/opt/zap-entregas` (mesmo disco). A cadeia VPS→loloserver→PC da memória do projeto está parada desde 16/08.
- **Impacto:** Perda total do histórico de corridas e da carteira do motoboy (26 lançamentos, 55 corridas, a dívida corrente com o João).
- **Correção sugerida:** Retomar a puxada do loloserver (ou um `rclone` pra um storage barato) incluindo `/opt/backups/zap-entregas/`. É o mesmo item já aberto na memória `project_automacoes_pc_windows_paradas`.
- **Confiança:** alta quanto ao backup local; média quanto ao "não existe cópia fora" — verifiquei a VPS, mas o `pull` pode estar agendado do lado do loloserver, que não inspecionei.

---

### [P1] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` só existe como build-arg e não está documentado
- **Onde:** `D:\Zap-Entregas\Dockerfile:14-15` (`ARG` + `ENV`), `D:\Zap-Entregas\README.md` (não menciona), `scripts\deploy\deploy.sh` (não passa `--build-arg`)
- **O que:** Essa chave é embutida no pacote JavaScript **no momento do build**, na máquina do Thon. Se o build for feito sem `--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=...`, a imagem sai com a variável vazia. Nada no README, no `deploy.sh` ou num `.env.example` avisa disso.
- **Como reproduzir / cenário concreto:** `docker build -t zap-entregas:prod .` (o comando óbvio) → imagem sem a chave → o `usePushNotifications.ts:88` registra o service worker mas a inscrição de push falha no navegador. **O deploy sobe sem erro nenhum**: o container fica verde, o log fica limpo, e a notificação simplesmente nunca chega no celular do motoboy. Hoje está correto (confirmei `NEXT_PUBLIC_VAPID_PUBLIC_KEY` de 87 caracteres começando em `BDF-` no `Config.Env` do container, igual ao `VAPID_PUBLIC_KEY` do `.env`).
- **Impacto:** Falha silenciosa no recurso mais crítico do motoboy (aviso de corrida nova), descoberta só quando alguém reclamar.
- **Correção sugerida:** Documentar o comando de build completo no README e no `deploy.sh`; melhor ainda, ler a chave em tempo de execução (rota que devolve a chave, como já é feito com `GOOGLE_MAPS_BROWSER_KEY`) e eliminar o build-arg.
- **Confiança:** alta.

---

### [P2] Sem healthcheck e com `CMD` encadeado por `&&`: falha de migração vira reinício infinito silencioso
- **Onde:** `D:\Zap-Entregas\Dockerfile:26` (`CMD ["sh","-c","node add_transaction_kind_column.js && ... && npm start"]`), `docker-compose.yml` (`restart: always`, sem `healthcheck`); `docker inspect` → `Healthcheck=null`
- **O que:** Se qualquer um dos quatro scripts de migração falhar (banco travado, coluna inesperada, permissão), o `&&` impede o `npm start` e o processo sai. Com `restart: always` e sem healthcheck, o Docker fica reiniciando para sempre, o `docker ps` mostra "Up X seconds" alternando, e ninguém é avisado.
- **Como reproduzir / cenário concreto:** Restaurar um backup mais antigo por cima do `sqlite.db` com o container rodando → o SQLite pode ficar travado, `add_transaction_kind_column.js` falha, e o app nunca sobe. `RestartCount=0` hoje, então nunca aconteceu — mas nada detectaria.
- **Impacto:** App fora do ar sem alarme. Vale notar que já existe um `check-health.sh` rodando de 5 em 5 minutos com alerta via ntfy no crontab, mas **só para o EpicStore** — o Zap não está nele.
- **Correção sugerida:** Adicionar `healthcheck` ao compose (um `curl -f http://localhost:3000/login`) e incluir a URL do Zap no `check-health.sh` que já manda alerta pro ntfy.
- **Confiança:** alta.

---

### [P2] Log do Docker sem rotação: um crash-loop enche o disco da VPS
- **Onde:** `D:\Zap-Entregas\docker-compose.yml` (sem `logging:`); `docker inspect zap-entregas` → `LogConfig={"Type":"json-file","Config":{}}`
- **O que:** `Config` vazio significa json-file **sem limite de tamanho nem de número de arquivos**. Hoje o log tem 3,1 KB (container novo) e `/var/lib/docker/containers` inteiro tem 35 MB, então não há problema agora.
- **Como reproduzir / cenário concreto:** Um erro em laço no Next (ou o crash-loop do achado anterior) escreve MBs por minuto até `/dev/sda1` encher — e aí **todos** os 14 containers da VPS param. Essa VPS já teve exatamente esse incidente em 21/07 (`project_vps_disk_incident_2026-07-21`).
- **Impacto:** Parada geral da VPS por causa de log de um serviço.
- **Correção sugerida:** `logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }` no compose.
- **Confiança:** alta.

---

### [P2] O volume monta o **arquivo** `sqlite.db`, não a pasta — WAL fica impossível e o banco é frágil a troca de arquivo
- **Onde:** `D:\Zap-Entregas\docker-compose.yml` (`- ./sqlite.db:/app/sqlite.db`); `docker inspect` → `Mounts: [{"Type":"bind","Source":"/opt/zap-entregas/sqlite.db",...}]`
- **O que:** Bind mount de arquivo único amarra o container a um **inode**, não a um caminho. Consequências: (a) se alguém substituir o banco com `mv`/`cp` de fora, o container continua escrevendo no arquivo antigo até reiniciar; (b) não dá pra ligar o WAL com segurança — os arquivos `sqlite.db-wal` e `-shm` seriam criados dentro do container, na camada descartável, e um restart perderia transações. Hoje `journal_mode=delete` (WAL desligado), que é o modo mais lento e serializa leitura com escrita.
- **Como reproduzir / cenário concreto:** Verifiquei agora que o inode bate (`788100` no host e no container), então **está tudo certo neste momento**. Mas o risco (a) é real toda vez que se restaura um backup por cima.
- **Impacto:** Restaurar backup "com o container de pé" grava numa cópia fantasma; e sob concorrência (motoboy + lojista + webhook do PDV ao mesmo tempo) o modo `delete` favorece `SQLITE_BUSY`. Não vi nenhum `SQLITE_BUSY` nos logs — o volume de uso ainda é baixo.
- **Correção sugerida:** Mover o banco para `/opt/zap-entregas/data/sqlite.db` e montar a **pasta** (`./data:/app/data`); aí dá pra ligar `PRAGMA journal_mode=WAL` com segurança.
- **Confiança:** alta.

---

### [P2] Imagem de 3,22 GB rodando como root, com código-fonte, `node_modules` de desenvolvimento e a pasta `android/` dentro
- **Onde:** `D:\Zap-Entregas\Dockerfile:1` (`FROM node:20` — imagem completa, não `-slim`/`-alpine`), sem `USER`, sem multi-stage; `docker exec zap-entregas id` → `uid=0(root)`
- **O que:** Uma imagem `node:20` completa com `npm ci` (dev incluso, incluindo `drizzle-kit`, `eslint`, `typescript`) e `COPY . .` gera 3,22 GB. Como o deploy é `docker save | gzip | ssh`, **cada deploy transfere esse peso pela internet**. Duas tags (`prod` + `rollback`) = 6,4 GB dos 11,1 GB de imagens da VPS.
- **Como reproduzir / cenário concreto:** `docker images | grep zap` → `zap-entregas prod 3.22GB` e `zap-entregas rollback 3.22GB`. `docker system df` → 9,06 GB recuperáveis.
- **Impacto:** Deploy lento, disco consumido, e superfície de ataque maior (o container roda como root e tem compilador, `git`, código-fonte e keystore dentro). Uma imagem multi-stage com `next build` + `output: "standalone"` ficaria em torno de 200–400 MB.
- **Correção sugerida:** Multi-stage (`node:20` para build, `node:20-slim` para rodar), `output: "standalone"` no `next.config.ts`, `USER node`. Ganho grande, mexida contida.
- **Confiança:** alta.

---

### [P2] nginx sem HSTS nem cabeçalhos básicos de segurança
- **Onde:** `/etc/nginx/sites-available/zapentregas` (bloco `listen 443`, nenhum `add_header`)
- **O que:** `curl -sI https://zapentregas.duckdns.org/` não devolve `Strict-Transport-Security`, `X-Content-Type-Options` nem `Referrer-Policy`. O redirect 80→443 existe e funciona (`301`), e o `X-Frame-Options`/CSP vêm do `src/proxy.ts` (confirmado na resposta) — mas o navegador ainda aceita uma primeira visita em HTTP.
- **Como reproduzir / cenário concreto:** Motoboy num Wi-Fi público digita `zapentregas.duckdns.org` → a primeira requisição sai em HTTP claro e pode ser interceptada antes do 301. Com HSTS gravado, o navegador nem tenta.
- **Impacto:** Janela de sequestro de sessão em rede hostil. Baixo na prática (o app é instalado e sempre abre em HTTPS), mas é uma linha de configuração.
- **Correção sugerida:** `add_header Strict-Transport-Security "max-age=31536000" always;` mais `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin` no bloco 443.
- **Confiança:** alta.

---

### [P2] TWA não é reconstruível: `twa-manifest.json` aponta pra um caminho do Ubuntu e `appVersionCode` está em 1
- **Onde:** `D:\Zap-Entregas\android\twa-manifest.json` → `"signingKey": { "path": "/mnt/dados/projetos/Zap-Entregas/android/zapentregas.keystore" }`, `"appVersionCode": 1`, `"fingerprints": []`
- **O que:** O caminho do keystore é o da máquina Linux antiga (a migração pro Windows foi em 30/08). O `bubblewrap build` de hoje falha por não achar a chave. E `appVersionCode: 1` significa que qualquer atualização precisa ser bumpada à mão — o Android recusa instalar um APK com versionCode igual ou menor.
- **Como reproduzir / cenário concreto:** Alterar algo no app (ícone, cor, startUrl) e rodar `bubblewrap build` → erro de arquivo não encontrado. Corrigido o caminho e buildado sem mexer no `appVersionCode`, o APK gerado não instala por cima do que está em `/opt/zap-entregas/downloads/zap-entregas.apk`.
- **Impacto:** Não dá pra publicar atualização do app sem descobrir isso na hora. O APK servido em produção é **exatamente** o de 20/08 (md5 `42db0e4e…` idêntico ao `android/app-release-signed.apk` local) — versionCode 1, `startUrl: /app`.
- **Correção sugerida:** Corrigir `signingKey.path` para o caminho Windows, subir `appVersionCode` a cada publicação, e anotar isso no `android/LEIA-ME.md`.
- **Confiança:** alta.

---

### [P2] VPS com 73–81% de CPU roubada pelo hypervisor e load 6,4 — não é culpa do Zap, mas afeta o Zap
- **Onde:** `top -bn1` → `80.0 st`, `load average: 6.41, 5.38, 4.55`; `vmstat` → coluna `st` em 73–81
- **O que:** "Steal time" é o tempo em que a máquina virtual quer CPU e o servidor físico não dá. 80% significa que a VPS só consegue usar 1/5 do processador que pede. O maior consumidor local é o próprio `dockerd` (65% de CPU, 6d21h acumuladas em 62 dias de uptime) — sintoma clássico de daemon com muitos containers e logs sem limite.
- **Como reproduzir / cenário concreto:** Uma ação do Zap que já é lenta (o geocode do endereço, com throttle de 1,1s e chamada externa ao Google) pode passar de 5s e o motoboy achar que travou. O `proxy_read_timeout` do nginx está no padrão (60s), então não chega a dar 504 — mas a percepção é ruim.
- **Impacto:** Lentidão geral, sem erro visível. Fora do escopo do Zap resolver, mas explica reclamações de "tá devagar".
- **Correção sugerida:** Item de infra da VPS (limitar logs, revisar os 14 containers, ou subir o plano na Hostinger). Não mexer só por causa do Zap.
- **Confiança:** alta na medição; média na atribuição da causa do `dockerd`.

---

### [P3] `app_logs` cresce sem nenhuma poda
- **Onde:** `D:\Zap-Entregas\src\app\api\logs\route.ts:33-44` (insere); busca por `delete`/`prune` em `src/` e `scripts/` não retorna nada
- **O que:** Todo login grava uma linha "Sessão iniciada" e não existe rotina que apague linhas antigas. Hoje são 323 linhas desde 14/05 (322 `info`, 1 `error`), o banco inteiro tem 248 KB — está longe de ser problema.
- **Como reproduzir / cenário concreto:** Com 10 lojas em vez de 1, a tabela vira o maior objeto do banco e o `VACUUM INTO` do backup fica lento.
- **Impacto:** Nenhum hoje. É dívida a marcar antes de escalar.
- **Correção sugerida:** Um `DELETE FROM app_logs WHERE created_at < date('now','-90 days')` no mesmo lugar das migrações do `CMD`.
- **Confiança:** alta.

---

### [P3] `next-pwa` é dependência instalada e nunca usada
- **Onde:** `D:\Zap-Entregas\package.json` (`"next-pwa": "^5.6.0"` em `dependencies`); `grep next-pwa src/ next.config.ts` não retorna nada
- **O que:** O `next-pwa` está instalado mas não é chamado em lugar nenhum — o service worker é o `public/sw.js` escrito à mão. Ele arrasta `workbox` inteiro pro `node_modules` da imagem.
- **Impacto:** Peso morto na imagem, e confusão futura pra quem for mexer no PWA achando que existe geração automática de cache.
- **Correção sugerida:** Remover a dependência.
- **Confiança:** alta.

---

### [P3] `/.well-known/assetlinks.json` tem só um fingerprint — o do Play App Signing vai faltar
- **Onde:** `D:\Zap-Entregas\src\app\api\assetlinks\route.ts:17-19`, variável `ANDROID_CERT_FINGERPRINTS` na VPS (95 caracteres = exatamente 1 fingerprint)
- **O que:** A rota já suporta lista separada por vírgula, o que é o desenho certo. Hoje serve só `B2:A6:57:...:A6:A9`, que é a chave local. Quando o app entrar na Play Store com Play App Signing, o Google reassina com **outra** chave e o fingerprint publicado muda.
- **Como reproduzir / cenário concreto:** Publicar na Play Store sem acrescentar o fingerprint que o Google mostra em "Integridade do app" → o app instalado da loja abre com a barra de endereço do Chrome à mostra, parecendo um site e não um aplicativo.
- **Impacto:** Só quando a publicação na Play Store acontecer (pendência já conhecida do projeto). Não afeta o APK distribuído por `/baixar/`.
- **Correção sugerida:** Ao publicar, acrescentar o fingerprint do Google ao `ANDROID_CERT_FINGERPRINTS` do `.env` da VPS e reiniciar o container (a rota lê em tempo de execução, então não precisa rebuildar).
- **Confiança:** alta.

---

## Coisas verificadas e OK (lista curta — pra não re-auditar)

- **Saúde agora:** container `Up 23 horas`, `RestartCount=0`, `OOMKilled=false`, 139,9 MiB de RAM, 0% CPU. `journalctl -k | grep oom` vazio. Log do container limpo (só avisos de `metadataBase` e `themeColor` do Next).
- **nginx `proxy_pass 127.0.0.1:4000` — o fix de 06/09 ESTÁ aplicado.** Confirmado no arquivo (mtime 06/09 11:22) e no `error.log`, onde os `connect() failed ... upstream: http://[::1]:4000` param exatamente às 10:24 de 06/09, antes do reload. Nenhum erro de upstream do Zap depois disso.
- **Redirect 80→443:** `curl -sI http://.../app` → `301 Moved Permanently`. HTTP/2 ativo no 443.
- **Certificado e renovação automática:** vence **11/10/2026** (34 dias), emissor Let's Encrypt. `certbot.timer` ativo, rodou hoje às 05:07, próxima às 21:51. O `renewal/zapentregas.duckdns.org.conf` usa `authenticator = nginx` e `installer = nginx` — ou seja, o plugin injeta o desafio e recarrega o nginx sozinho; o bloco `:80` ser só `return 301` **não** atrapalha (isso só seria problema com o plugin `webroot`). `renew_before_expiry = 30 days` → renova por volta de 11/09.
- **Nenhum 5xx do Zap.** Os 12× `500` e 4× `502` em `POST /login` do `access.log.1` são do **epichub** (mesmo IP `80.225.231.81` e mesmos segundos dos erros "upstream sent too big header" do `epichub.duckdns.org` no `error.log`). O log do nginx é compartilhado e não registra o host, daí a confusão.
- **`/.well-known/assetlinks.json`** chega no Next pelo rewrite do `next.config.ts:14` e responde `200` com o JSON correto (`package_name: shop.vaporfume.zapentregas`, fingerprint `B2:A6:57:…`), `cache-control: public, max-age=300`.
- **Cabeçalhos de iframe funcionando:** `content-security-policy: frame-ancestors 'self'` + `x-frame-options: SAMEORIGIN` nas páginas normais, vindos do `src/proxy.ts` em tempo de execução. `PDV_FRAME_ANCESTORS` (79 caracteres) está no container.
- **Todas as variáveis lidas pelo código chegam no container**, com uma exceção inofensiva: `OAUTH_BASE_URL` não está no `.env` nem no compose da VPS, mas `src/lib/appUrl.ts:19-22` cai em `APP_URL` (presente, 31 caracteres) e depois num literal correto. Não é um defeito.
- **`SESSION_SECRET` tem 64 caracteres** e `MASTER_ADMIN_KEY` 32 — acima do mínimo.
- **`SMTP_*` vazio não causa problema:** `requestPasswordResetAction` (`src/app/actions/password-reset.ts:13`) **não é chamada de lugar nenhum** — a tela `/login/forgot-password` é a "versão honesta" que manda falar com a loja. O código de reset por e-mail é morto; nenhum usuário recebe a promessa falsa de "você receberá um link".
- **Banco íntegro:** `PRAGMA integrity_check` = `ok`, `foreign_key_check` = `[]` (vazio), 62 páginas de 4096 bytes. Sem `-wal`/`-shm` órfãos.
- **Backup diário funcionando:** `zap ok` no log de 06/09 e 07/09; 15 arquivos de 24/08 a 07/09 em `/opt/backups/zap-entregas/`, o mais recente de hoje 03:17 (21 KB comprimido); usa `VACUUM INTO` (consistente) e poda com `-mtime +14`. O `.env` do Zap também entra no `configs_*.tar.gz` diário.
- **Uploads:** `/opt/zap-entregas/uploads` existe, montado no container, 8 arquivos, 688 KB, `644 root:root`. Sem crescimento preocupante. **Não** está no backup automático (só o banco entra) — mas são avatares, recuperáveis; não vale abrir achado.
- **Código velho em `/opt/zap-entregas` não afeta a execução.** O git de lá está em `68cfde2` (18/08) com `Dockerfile` e `next.config.mjs` antigos, mas `docker inspect` confirma que os **únicos** mounts são `sqlite.db` e `uploads` — nenhum volume monta código por cima. O `Cmd` do container é o do Dockerfile novo (as 4 migrações + `npm start`), e o log de boot mostra as quatro rodando e passando.
- **Rollback rápido existe:** `zap-entregas:rollback` (3,22 GB, de 9 dias atrás) está guardada. `journalctl -u docker` registra a criação da tag em 06/09 10:36, antes do deploy das 11:22.
- **Service worker sem risco de servir app velho:** `public/sw.js` **não tem handler de `fetch`** — não faz cache de nada (nem HTML, nem server action). Só trata `push` e `notificationclick`. Tem `skipWaiting()` no install e `clients.claim()` no activate, e é servido com `cache-control: public, max-age=0` (revalida sempre). O `SW_VERSION` manual é só documentação; o bump não é necessário pra atualizar.
- **`manifest.json`** coerente: `id: "/"`, `start_url: "/"`, `scope: "/"`, ícones 192/512/maskable/monochrome presentes em `public/`.
- **`/baixar/zap-entregas.apk`** responde `200`, `content-type: application/vnd.android.package-archive`, `content-disposition: attachment`, 2.215.669 bytes — md5 idêntico ao `android/app-release-signed.apk` local.
- **`client_max_body_size 500M`** global no `nginx.conf:13` — o nginx não é o gargalo de upload.
- **gzip ativo** nas respostas do app (`content-encoding: gzip` no HTML) — vem da compressão do próprio Next, então os `_next/static` também saem comprimidos.
- **`ufw` ativo** e a porta 4000 não está liberada; o container publica em `127.0.0.1:4000` (compose da VPS), então o app só é alcançável pelo nginx.
- **Disco confortável:** 20 GB usados de 48 GB (43%), 28 GB livres. Existe cron de poda do Docker (`/etc/cron.d/docker-prune`, `docker-image-prune`, `docker-builder-prune`).
- **Git local limpo**, `main` em `573bb0d`, sem arquivo pendente.

---

## Estado de produção (07/09/2026)

| Item | Valor |
| --- | --- |
| **Container** | `zap-entregas`, imagem `zap-entregas:prod` (`fd9227cdafd5`, 24 h) |
| Estado / uptime | `Up 23 horas` (iniciado 06/09 14:22 UTC), `running` |
| RestartCount / OOMKilled | **0** / `false` |
| Healthcheck | **nenhum** (`Healthcheck=null`) |
| Limite de memória / CPU | **nenhum** (`Memory=0`, `NanoCpus=0`) — único container da VPS sem teto |
| Uso atual | 139,9 MiB (3,57% de 3,823 GiB), CPU 0,00% |
| Usuário dentro do container | **root** (`uid=0`) |
| Rotação de log do Docker | **nenhuma** (`json-file` sem `max-size`); arquivo atual 3,1 KB |
| Porta | `127.0.0.1:4000 → 3000` (correto) |
| Mounts | só `sqlite.db` (arquivo) e `uploads/` (pasta) |
| **Imagem** | 3,22 GB (`prod`) + 3,22 GB (`rollback`) = 6,4 GB dos 11,1 GB da VPS |
| Conteúdo indevido na imagem | `/app/android/` com keystore (2.754 B) e `keystore-password.txt` (25 B) |
| **Banco** `/opt/zap-entregas/sqlite.db` | 253.952 B (248 KB), `644 root:root`, inode 788100 (bate com o do container) |
| `journal_mode` | `delete` (WAL desligado); sem `-wal`/`-shm` |
| `PRAGMA integrity_check` | **ok** |
| `foreign_key_check` | vazio (nenhuma violação) |
| Última escrita no banco | 05/09 18:24 (local) — nenhuma corrida em 06 e 07/09 (fim de semana + feriado) |
| **users** | 5 → 1 admin, 2 lojistas, 2 motoboys (todos ativos) |
| **deliveries** | 55 → 29 `delivered`, 13 `pending`, 6 `draft`, 4 `picked_up`, 3 `canceled` |
| **transactions** | 26 (última em 05/09 20:47, tipo `corrida`) |
| **push_subscriptions** | **1** (só um aparelho inscrito em notificação) |
| **webauthn_credentials** | 2 |
| **app_logs** | 323 linhas (322 `info`, 1 `error`), de 14/05 a 05/09 — sem poda |
| Último `error` no app_logs | 05/09 21:23 — "Server Components render" genérico (mensagem omitida em produção) |
| Tabelas com 0 linhas | `financial_records`, `master_events`, `master_products`, `password_resets`, `reviews`, `subscriptions` |
| Tabela de GPS | **não existe** no schema |
| **Backups manuais** (`sqlite.db.bak-*`) | 13 arquivos, ~2,1 MB, o mais recente `2026-09-06-pre-googlefix` (248 KB) |
| **Backup automático** | `/opt/backups/backup-epiccorp.sh`, cron 03:15, `VACUUM INTO` + gzip, retenção 15 dias |
| Backups automáticos presentes | 15 arquivos (24/08 → 07/09), o de hoje 03:17 com 21.402 B |
| Cópia fora da VPS | **não encontrada** (sem rsync/scp no cron) |
| **Uploads** | `/opt/zap-entregas/uploads`, 8 arquivos, 688 KB, `644 root:root` — fora do backup |
| **APK servido** | `/baixar/zap-entregas.apk`, 2.215.669 B, md5 `42db0e4edf8d231a0cc31a3fe044cbff`, de 28/08 |
| APK local | `android/app-release-signed.apk` — **md5 idêntico** |
| `appVersionCode` (TWA) | **1** |
| Fingerprint no assetlinks | 1 (`B2:A6:57:…:A6:A9`), bate com `ANDROID_CERT_FINGERPRINTS` (95 caracteres) |
| **Certificado TLS** | Let's Encrypt ECDSA, válido até **11/10/2026** (34 dias) |
| Renovação automática | `certbot.timer` ativo (2×/dia), plugin `nginx` autenticador **e** instalador → recarrega sozinho |
| Redirect 80→443 | `301` ✔ |
| HSTS / nosniff / referrer-policy | **ausentes** |
| CSP / X-Frame-Options | presentes, vindos do `src/proxy.ts` |
| 5xx do Zap (48 h) | **0** (os 500/502 do log são do `epichub.duckdns.org`) |
| Erros do nginx pro Zap | últimos em 06/09 10:24 (`[::1]:4000`), antes do fix — nenhum depois |
| **Variáveis no container** | 22 do `.env` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (build-arg, 87 caracteres, bate com a `VAPID_PUBLIC_KEY`) |
| Variável lida no código e ausente | só `OAUTH_BASE_URL` (opcional — cai em `APP_URL`) |
| `SESSION_SECRET` / `MASTER_ADMIN_KEY` | 64 / 32 caracteres |
| `SMTP_*` | vazio (irrelevante: o fluxo de e-mail é código morto) |
| **VPS** | 3.915 MiB de RAM (490 livres, 652 em swap), disco 20/48 GB (43%) |
| Load average | **6,41 / 5,38 / 4,55** com **73–81% de CPU roubada** pelo hypervisor |
| Maior consumidor local | `dockerd` (65% de CPU, 6d21h em 62 dias de uptime) |
| Containers na VPS | 14 (Zap é o único sem limite de memória) |
| OOM kills | nenhum (`journalctl -k` limpo) |
| `ufw` | ativo; 4000 não liberada |

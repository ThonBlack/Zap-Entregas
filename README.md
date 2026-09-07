# 🏍️ Zap Entregas

Sistema de gestão de entregas com rastreio em tempo real, integração WhatsApp e modelo SaaS.

## 📱 Visão Geral

Aplicação web (PWA) para **lojistas** gerenciarem entregas e **motoboys** receberem e executarem corridas. Inclui rastreio GPS em tempo real, otimização de rotas e modelo de monetização por assinatura.

---

## 🛠️ Stack Tecnológica

| Tecnologia | Uso |
|------------|-----|
| **Next.js 16.1** | Framework React (App Router, React 19) |
| **TypeScript** | Tipagem — o build **falha** se houver erro de tipo (não desligue essa trava) |
| **Drizzle ORM** | Banco de dados (SQLite) |
| **Tailwind CSS** | Estilização |
| **Leaflet** | Mapas (react-leaflet) |
| **Lucide React** | Ícones |
| **PWA** | Instalável no celular |
| **Docker** | Containerização e Deploy |

---

## 📁 Estrutura de Diretórios (Refatorado)

```
src/
├── app/
│   ├── actions/          # Server Actions
│   ├── admin/            # Painel admin (SaaS, Master, Users)
│   ├── ...               # Outras rotas (login, tracking, etc)
├── components/           # Componentes organizados por feature
│   ├── admin/            # Componentes de administração
│   ├── auth/             # Componentes de autenticação
│   ├── billing/          # Componentes de faturamento/planos
│   ├── dashboard/        # Views principais do dashboard
│   ├── deliveries/       # Componentes de entregas
│   ├── map/              # Componentes de mapa e rastreio
│   ├── shared/           # Componentes compartilhados (Logger, Notifications)
│   └── ui/               # Componentes base (shadcn/ui)
├── db/
│   ├── index.ts          # Conexão Drizzle
│   └── schema.ts         # Tabelas
scripts/
├── deploy/               # Scripts de deploy (deploy.sh)
├── migrations/           # Scripts de migração legados
└── utils/                # Scripts utilitários (create_admin, seed)
```

---

## 🚀 Como Rodar

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Variáveis: copie o modelo e preencha
cp .env.example .env.local

# Rodar em desenvolvimento
npm run dev

# Helper Scripts
npm run script:create-admin   # Criar admin
npm run script:seed-plans     # Popular planos
```

`.env.example` lista **todas** as variáveis, uma por linha, dizendo o que cada
uma faz e se é obrigatória. Nada de `NEXT_PUBLIC_*` para valor que depende do
ambiente: a imagem Docker é montada na máquina do Thon e a env ficaria congelada
dentro do pacote (a única exceção é a chave pública de push, explicada abaixo).

### Antes de considerar pronto

```bash
npm test            # testes (node --test) — banco descartável, não toca no seu sqlite.db
npx tsc --noEmit    # tem que dar ZERO erro
npm run lint        # 10 erros pré-existentes de react-hooks em mapa/ReviewForm; não acrescente novos
npm run build       # se der erro de tipo, conserte o erro
```

---

## 🚢 Deploy (produção)

**Onde a coisa mora:** VPS Hostinger `72.61.135.4`, pasta `/opt/zap-entregas`
(o `.env` de verdade, o `sqlite.db`, `uploads/` e `downloads/`), container
`zap-entregas` publicado em `127.0.0.1:4000`, nginx na frente com HTTPS.

**A VPS nunca constrói nada.** Ela tem 3,8 GB de RAM e 14 containers; o build do
Next não cabe lá, e o Compose remove o container de produção *antes* de construir
o novo — se o build falhasse, o app ficaria fora do ar sem nada pra onde voltar.
Então a imagem é construída na máquina do Thon e viaja pronta pela rede
(`docker save | gzip | ssh | docker load`).

> ⚠️ **Não rode `docker compose up -d --build` na VPS.** Era o que este README
> mandava fazer até 07/09/2026, e é exatamente a receita de derrubar a produção.

### O caminho normal

```bash
# na máquina do Thon, com o repo limpo e a main já no GitHub
bash scripts/deploy/deploy.sh
```

O script faz, em sete passos, o que antes era feito na mão:

1. **exige árvore limpa e `main` igual à `origin/main`** — só sobe pra produção o
   que já está no GitHub;
2. lê `NEXT_PUBLIC_VAPID_PUBLIC_KEY` do `.env.local` e **aborta se estiver
   vazia**;
3. `docker build --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=... -t zap-entregas:prod .`;
4. **prova** que `android/` e `.env.local` não entraram na imagem;
5. na VPS: marca a imagem em produção como `zap-entregas:rollback` e faz cópia do
   banco (`VACUUM INTO sqlite.db.bak-<data>`);
6. manda a imagem e sobe com `docker compose up -d --no-build`;
7. espera o healthcheck ficar `healthy` e confere `https://zapentregas.duckdns.org/login`
   de fora.

### A chave de push é embutida no build (build-arg)

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` é a **única** variável que entra no pacote
JavaScript na hora do build. Construir sem ela **não dá erro nenhum**: o
container sobe verde, o log fica limpo, e a notificação de corrida nova
simplesmente nunca chega no celular do motoboy. Se for construir na mão:

```bash
docker build --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=<a chave pública> -t zap-entregas:prod .
```

Ela tem que ser **a mesma** `VAPID_PUBLIC_KEY` do `.env` da VPS. Divergindo, o
navegador se inscreve com uma chave e o servidor assina com outra.

### Voltar atrás

```bash
bash scripts/deploy/rollback.sh
```

Troca `zap-entregas:rollback` de volta pra `:prod` e sobe de novo em menos de um
minuto. **Não mexe no banco de propósito** — as migrações do Zap são só aditivas,
então a versão anterior roda bem num banco já migrado.

### Restaurar o banco de um backup

Só se for mesmo necessário, e sempre **com o container parado**: o volume monta o
arquivo `sqlite.db`, e trocar o arquivo com o container de pé não adianta (ele
continua escrevendo no arquivo antigo até reiniciar).

```bash
ssh root@72.61.135.4
cd /opt/zap-entregas
ls -lt sqlite.db.bak-*                       # cópias feitas por cada deploy
ls -lt /opt/backups/zap-entregas/            # backup diário (03:15, 15 dias, gzip)
docker compose stop
cp sqlite.db sqlite.db.antes-do-restore      # rede de segurança
cp sqlite.db.bak-<data> sqlite.db            # ou: gunzip -c /opt/backups/zap-entregas/<arquivo>.gz > sqlite.db
docker compose up -d --no-build              # as migrações rodam sozinhas no boot
```

### Arquivos de infra que o deploy NÃO copia

Mexer neles é decisão consciente, feita à mão:

| Arquivo do repo | Onde mora na VPS | Como aplicar |
| --- | --- | --- |
| `docker-compose.yml` | `/opt/zap-entregas/docker-compose.yml` | `scp` e depois `docker compose up -d --no-build` |
| `nginx-zapentregas.conf` | `/etc/nginx/sites-available/zapentregas` | `scp` e depois `nginx -t && systemctl reload nginx` |
| `.env` (nunca versionado) | `/opt/zap-entregas/.env` | editar na mão; modelo em `.env.example` |

---

## 🗺️ Mapas (Google)

São **duas chaves diferentes** do Google, e elas não se misturam:

| Variável | Onde roda | Pra que serve |
| --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | servidor | achar o endereço no mapa (geocode) e as sugestões do campo de endereço |
| `GOOGLE_MAPS_BROWSER_KEY` | navegador | desenhar o mapa da conferência e do rastreio (Maps JavaScript API) |

A chave do navegador aparece no HTML da página — por isso ela **precisa** estar
restrita por site (referrer) no console do Google, senão qualquer um usa e a conta paga.

**Como criar a chave do navegador:**

1. Console do Google → *APIs e serviços* → *Credenciais* → *Criar credencial* → *Chave de API*.
2. Ative a **Maps JavaScript API** no projeto.
3. Na chave, em *Restrições de aplicativo*, escolha **Sites** e adicione
   `https://zapentregas.duckdns.org/*` e `http://localhost:3005/*` (pra testar).
4. Em *Restrições de API*, deixe só a Maps JavaScript API.
5. Ponha em `.env.local` (local) ou no `.env` do servidor (produção) como
   `GOOGLE_MAPS_BROWSER_KEY=...` e reinicie o container.

> Nada de `NEXT_PUBLIC_*` aqui: a imagem Docker é montada fora do servidor e a env
> ficaria congelada dentro do pacote. A chave é lida em tempo de execução e entregue
> pras telas por prop.

**Se a chave faltar, estiver errada ou a internet cair**, o mapa volta sozinho pro
OpenStreetMap (Leaflet) — a tela nunca fica sem mapa.

**Testar:**

```bash
# Sem chave: conferência abre no OpenStreetMap
GOOGLE_MAPS_BROWSER_KEY= PORT=3005 npm start

# Com chave de verdade: abre no Google (ruas de Uberaba que o OSM não tem)
GOOGLE_MAPS_BROWSER_KEY=AIza... PORT=3005 npm start
```

---

## 🔐 Quem pode criar conta

`/register` é público (o app é instalável e o link circula no WhatsApp), mas
**conta de lojista não sai por cadastro aberto** — quem é lojista vê endereço,
telefone e dinheiro da operação.

| Variável | Onde roda | Pra que serve |
| --- | --- | --- |
| `REGISTER_SHOPKEEPER_CODE` | servidor | libera a opção "Sou Lojista" em `/register` |

- A tela nasce em **"Sou Motoboy"**. A opção de lojista só aparece quando a URL
  traz `?convite_lojista=<REGISTER_SHOPKEEPER_CODE>`, e a server action confere o
  código de novo (a tela nunca é a tranca).
- **Vazio ou não configurado = ninguém se cadastra como lojista.** Quem cria é o
  admin, em `/admin/users/new`. Esse é o padrão, e é o certo pra hoje: o app
  atende uma loja só.
- Nada de `NEXT_PUBLIC_*`: a imagem Docker é montada fora do servidor e a env
  ficaria congelada dentro do pacote. É lida em tempo de execução.

Pra abrir o cadastro de uma loja nova: ponha um código aleatório no `.env` do
servidor, reinicie o container e mande o link
`https://zapentregas.duckdns.org/register?convite_lojista=<código>` pra pessoa.

---

## 🗄️ Banco de Dados

- **SQLite**: Local ou volume Docker (`/data/sqlite.db`).
- **Chave estrangeira LIGADA** (`PRAGMA foreign_keys = ON` em `src/db/index.ts`).
  Consequência prática: não dá pra apagar um usuário que tem corrida ou
  lançamento — por isso excluir motoboy com histórico vira **desativação**
  (`is_active = 0`), que mantém o extrato e a dívida de pé.
- **Migrações**: scripts aditivos em `scripts/utils/add_*.js` — sobem sozinhos a
  cada deploy e são repetíveis (se a coluna já existe, não fazem nada).
  **Não usar `drizzle-kit push` em produção.**

Quem chama todos, na ordem certa, é **`scripts/utils/migrate_all.js`**, e é ele
que está no `CMD` do Dockerfile:

```
CMD ["sh", "-c", "node scripts/utils/migrate_all.js && npm start"]
```

A lista mora dentro do `migrate_all.js`, comentada, com a explicação de por que
cada bloco vem antes do outro (tudo que mexe em `users` roda antes do
`make_phone_nullable.js`, que refaz a tabela inteira). No fim da fila entra o
`prune_app_logs.js`, que apaga registro de log com mais de 90 dias.

> Antes de 07/09/2026 a lista era uma linha do `CMD` com quatro scripts, e
> **seis** outros existiam na pasta sem nunca serem chamados (login com Google,
> WebAuthn, conferência do PDV, precisão do endereço, localização da loja,
> visibilidade). Quem restaurasse um backup antigo subia o app sem essas colunas.

`npm test` roda `scripts/test/migrate_all.test.mjs`, que reclama se alguém criar
um `add_*.js` novo e esquecer de acrescentar à lista, e prova que rodar tudo duas
vezes seguidas não muda nada.

Rodar à mão, num banco local:

```bash
DATABASE_PATH=./sqlite.db node scripts/utils/migrate_all.js
```

> `add_shopkeeper_id_column.js` faz **backfill**: motoboy que já existia fica
> ligado ao lojista de id 2 (Vapor Fume, dono da chave do PDV). Pra outro id:
> `BACKFILL_SHOPKEEPER_ID=3 node scripts/utils/add_shopkeeper_id_column.js`.

---

## 📲 Aplicativo Android (TWA)

O "aplicativo" é o próprio site aberto em tela cheia — não existe código Android
escrito à mão. A pasta `android/` **não vai pro Git nem pra imagem Docker**,
porque a chave que assina o app publicado mora lá dentro (`.gitignore` tem
`/android/`; o `.dockerignore` tem `android`, `*.keystore`, `*.apk`, `*.aab` e
`keystore-password.txt`).

O passo a passo completo — gerar versão nova, subir `appVersionCode`, copiar o
APK pra VPS e acrescentar o fingerprint do Play App Signing em
`ANDROID_CERT_FINGERPRINTS` — está em **`android/LEIA-ME.md`**, na máquina do
Thon. Duas regras que valem repetir aqui:

- **`appVersionCode` tem que crescer a cada publicação.** O Android recusa
  instalar por cima um APK com número igual ou menor, e a Play Store recusa o
  envio.
- **A chave (`zapentregas.keystore`) precisa ter backup fora da pasta do
  projeto.** Perdê-la significa nunca mais conseguir atualizar o app publicado.

---

*Última atualização: 07/09/2026 — auditoria fase 3 (infra, deploy, migrações, cabeçalhos de segurança)*

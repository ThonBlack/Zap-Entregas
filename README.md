# 🏍️ Zap Entregas

Sistema de gestão de entregas com rastreio em tempo real, integração WhatsApp e modelo SaaS.

## 📱 Visão Geral

Aplicação web (PWA) para **lojistas** gerenciarem entregas e **motoboys** receberem e executarem corridas. Inclui rastreio GPS em tempo real, otimização de rotas e modelo de monetização por assinatura.

---

## 🛠️ Stack Tecnológica

| Tecnologia | Uso |
|------------|-----|
| **Next.js 15** | Framework React (App Router) |
| **TypeScript** | Tipagem |
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

# Rodar em desenvolvimento
npm run dev

# Helper Scripts
npm run script:create-admin   # Criar admin
npm run script:seed-plans     # Popular planos
```

### Docker (Produção)

```bash
# Build e Start via Docker Compose
docker compose up -d --build
```

O deploy para VPS pode ser feito utilizando o script `scripts/deploy/deploy.sh`.

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
- **Migrações**: scripts aditivos em `scripts/utils/add_*.js`, chamados no `CMD`
  do Dockerfile — sobem sozinhos a cada deploy e são repetíveis (se a coluna já
  existe, não fazem nada). **Não usar `drizzle-kit push` em produção.**

Scripts que rodam no boot do container, nesta ordem:

```
add_transaction_kind_column.js
make_phone_nullable.js
add_invite_token_columns.js
add_shopkeeper_id_column.js   # vínculo loja ↔ motoboy (users.shopkeeper_id)
```

> `add_shopkeeper_id_column.js` faz **backfill**: motoboy que já existia fica
> ligado ao lojista de id 2 (Vapor Fume, dono da chave do PDV). Pra outro id:
> `BACKFILL_SHOPKEEPER_ID=3 node scripts/utils/add_shopkeeper_id_column.js`.

---

*Última atualização: 29/08/2026 - Rodada de segurança (isolamento por loja, sessão, cadastro)*

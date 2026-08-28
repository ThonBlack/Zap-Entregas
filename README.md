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

## 🗄️ Banco de Dados

- **SQLite**: Local ou volume Docker (`/data/sqlite.db`).
- **Migrações**: Gerenciadas via Drizzle ORM.

---

*Última atualização: 23/01/2026 - Refatoração Completa*

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

## 🗄️ Banco de Dados

- **SQLite**: Local ou volume Docker (`/data/sqlite.db`).
- **Migrações**: Gerenciadas via Drizzle ORM.

---

*Última atualização: 23/01/2026 - Refatoração Completa*

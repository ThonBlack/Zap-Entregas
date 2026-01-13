# 🎛️ ThonHub - Guia Completo de Implementação

> **Para:** Agente de desenvolvimento
> **De:** Thon Black
> **Data:** Janeiro 2026
> **Objetivo:** Criar um painel central de gestão multi-produto independente

---

## 📋 Visão Geral do Projeto

O **ThonHub** é um painel administrativo centralizado para gerenciar múltiplos produtos digitais. Ele deve ser um **projeto Next.js separado** com seu próprio banco de dados, login e hospedagem.

### Produtos a Gerenciar (inicial)
1. 🛵 **Zap Entregas** - SaaS de gestão de entregas para lojistas
2. 🛒 **Loja Online** - E-commerce próprio
3. 🏪 **SaaS de Lojas** - Plataforma para criar lojas online
4. 🎬 **Streaming** - Software de terceiro para gerenciar assinaturas de filmes/séries
5. *(mais produtos serão adicionados - meta: 6+ até próximo mês)*

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         THON HUB                                │
│                   (Projeto Next.js Separado)                    │
│                   Porta: 4001 ou subdomínio                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [📊 Visão Geral]  [🛵 Zap]  [🛒 Loja]  [🏪 SaaS]  [🎬 Stream]  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MÉTRICAS CONSOLIDADAS                                   │   │
│  │  💰 Faturamento Total Mensal (soma de todos produtos)   │   │
│  │  👥 Usuários/Clientes Totais                            │   │
│  │  📈 MRR/ARR Global                                      │   │
│  │  📊 Gráfico de crescimento por produto                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CARDS POR PRODUTO (clicáveis para detalhes)             │   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │   │
│  │ │🛵 Zap   │ │🛒 Loja  │ │🏪 SaaS  │ │🎬Stream │         │   │
│  │ │R$5.000  │ │R$8.000  │ │R$2.000  │ │R$1.500  │         │   │
│  │ │150 users│ │300 cli  │ │80 lojas │ │200 assi │         │   │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ API REST + Webhooks
                              ▼
┌──────────┬──────────┬──────────┬──────────┐
│ Zap      │ Loja     │ SaaS     │ Streaming│
│ Entregas │ Online   │ Lojas    │ (manual) │
│ (SDK)    │ (SDK)    │ (SDK)    │          │
└──────────┴──────────┴──────────┴──────────┘
```

---

## 📁 Estrutura de Pastas

```
ThonHub/
├── .env                          # Variáveis de ambiente
├── .env.example                  # Exemplo de .env
├── package.json
├── next.config.ts
├── Dockerfile
├── docker-compose.yml
│
├── public/
│   ├── favicon.ico
│   └── sdk/
│       └── thonhub.min.js        # SDK para integrar produtos
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Layout principal (dark theme)
│   │   ├── page.tsx              # Dashboard - Visão Geral
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx          # Login (separado do Zap)
│   │   │
│   │   ├── products/
│   │   │   ├── page.tsx          # Lista de produtos
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Adicionar produto
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Detalhes do produto (métricas específicas)
│   │   │
│   │   ├── payments/
│   │   │   └── page.tsx          # Histórico de pagamentos (Asaas)
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx          # Configurações do Hub
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       │
│   │       ├── products/
│   │       │   └── route.ts      # CRUD produtos
│   │       │
│   │       ├── events/
│   │       │   └── route.ts      # Receber eventos dos produtos (SDK)
│   │       │
│   │       ├── stats/
│   │       │   └── route.ts      # Estatísticas consolidadas
│   │       │
│   │       └── webhooks/
│   │           └── asaas/
│   │               └── route.ts  # Webhook do Asaas
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── ProductCard.tsx
│   │   ├── RevenueChart.tsx
│   │   ├── ProductTabs.tsx
│   │   ├── EventsList.tsx
│   │   └── PaymentsList.tsx
│   │
│   ├── db/
│   │   ├── index.ts              # Conexão Drizzle
│   │   └── schema.ts             # Tabelas
│   │
│   └── lib/
│       ├── asaas.ts              # Cliente API Asaas
│       └── auth.ts               # Helpers de autenticação
│
└── drizzle/                      # Migrations
```

---

## 💾 Schema do Banco de Dados

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Usuários do Hub (login separado)
export const hubUsers = sqliteTable("hub_users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "viewer"] }).default("admin"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Produtos gerenciados
export const products = sqliteTable("products", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),                    // "Zap Entregas"
    slug: text("slug").notNull().unique(),           // "zap-entregas"
    description: text("description"),
    type: text("type", { 
        enum: ["saas", "ecommerce", "app", "subscription", "other"] 
    }).notNull(),
    icon: text("icon"),                              // Emoji ou URL do ícone
    color: text("color"),                            // Cor do card (hex)
    apiKey: text("api_key").notNull().unique(),      // Para SDK
    webhookUrl: text("webhook_url"),                 // URL para notificar produto
    asaasAccountId: text("asaas_account_id"),        // Conta Asaas vinculada
    externalApiUrl: text("external_api_url"),        // API do produto (se houver)
    isActive: integer("is_active", { mode: 'boolean' }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Eventos recebidos dos produtos
export const events = sqliteTable("events", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").references(() => products.id).notNull(),
    eventType: text("event_type", { 
        enum: ["signup", "login", "purchase", "cancel", "refund", "error", "custom"] 
    }).notNull(),
    userId: text("user_id"),                         // ID do usuário no produto
    amount: real("amount"),                          // Valor (se transação)
    currency: text("currency").default("BRL"),
    metadata: text("metadata"),                      // JSON com dados extras
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Transações do Asaas
export const asaasTransactions = sqliteTable("asaas_transactions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").references(() => products.id),
    asaasId: text("asaas_id").notNull(),             // ID no Asaas
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    amount: real("amount").notNull(),
    netValue: real("net_value"),                     // Valor líquido
    status: text("status", { 
        enum: ["PENDING", "CONFIRMED", "RECEIVED", "REFUNDED", "CANCELLED"] 
    }).notNull(),
    type: text("type", { 
        enum: ["PAYMENT", "SUBSCRIPTION"] 
    }),
    billingType: text("billing_type"),               // PIX, BOLETO, CREDIT_CARD
    dueDate: text("due_date"),
    paymentDate: text("payment_date"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
```

---

## 🔐 Autenticação

O Hub tem **login próprio**, não usa credenciais do Zap Entregas.

### Fluxo
1. Email + senha
2. Criar cookie `hub_user_id`
3. Proteger rotas verificando cookie

### Criar primeiro admin
```typescript
// scripts/create_admin.ts
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const db = new Database("hub.db");
const hash = bcrypt.hashSync("sua_senha_segura", 10);

db.prepare(`
    INSERT INTO hub_users (email, password, name, role)
    VALUES (?, ?, ?, ?)
`).run("thon@email.com", hash, "Thon Black", "admin");

console.log("Admin criado!");
```

---

## 💳 Integração Asaas

### Configuração
```env
# .env
ASAAS_API_KEY=sua_api_key_producao
ASAAS_SANDBOX=false
ASAAS_WEBHOOK_TOKEN=token_secreto_para_validar
```

### Webhook Endpoint
```typescript
// src/app/api/webhooks/asaas/route.ts
import { db } from "@/db";
import { asaasTransactions, products } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const body = await request.json();
    
    // Validar token (opcional mas recomendado)
    const token = request.headers.get("asaas-access-token");
    if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = body.event;
    const payment = body.payment;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        // Identificar produto pelo customer ou metadata
        // Salvar transação
        await db.insert(asaasTransactions).values({
            asaasId: payment.id,
            customerEmail: payment.customer,
            amount: payment.value,
            netValue: payment.netValue,
            status: payment.status,
            billingType: payment.billingType,
            paymentDate: payment.paymentDate,
        });
    }

    return NextResponse.json({ received: true });
}
```

### Buscar Pagamentos
```typescript
// src/lib/asaas.ts
const ASAAS_URL = "https://api.asaas.com/v3";

export async function getPayments(limit = 50) {
    const res = await fetch(`${ASAAS_URL}/payments?limit=${limit}`, {
        headers: {
            "access_token": process.env.ASAAS_API_KEY!
        }
    });
    return res.json();
}

export async function getSubscriptions() {
    const res = await fetch(`${ASAAS_URL}/subscriptions`, {
        headers: {
            "access_token": process.env.ASAAS_API_KEY!
        }
    });
    return res.json();
}
```

---

## 📡 SDK para Produtos

Cada produto instala o SDK para enviar eventos automaticamente.

### Uso (em qualquer produto)
```javascript
// npm install @thon/hub-sdk
// ou incluir via script

ThonHub.init({
    apiKey: 'thonhub_zapentregas_abc123...',
    product: 'zap-entregas',
    endpoint: 'https://hub.thon.com.br/api/events'
});

// Reportar eventos
ThonHub.track('signup', { userId: 'user_123' });
ThonHub.track('purchase', { 
    userId: 'user_123', 
    amount: 49.90, 
    plan: 'pro',
    currency: 'BRL'
});
ThonHub.track('cancel', { userId: 'user_123', reason: 'price' });
```

### Endpoint que recebe
```typescript
// src/app/api/events/route.ts
export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("X-API-KEY");
    
    const product = await db.query.products.findFirst({
        where: eq(products.apiKey, apiKey)
    });
    
    if (!product) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    const body = await request.json();
    
    await db.insert(events).values({
        productId: product.id,
        eventType: body.event,
        userId: body.userId,
        amount: body.amount,
        metadata: JSON.stringify(body.metadata || {})
    });

    return NextResponse.json({ success: true });
}
```

---

## 🎨 Design

- **Tema:** Dark mode (igual Zap Entregas)
- **Cores:** Verde (#22c55e) como principal
- **Biblioteca:** shadcn/ui + Tailwind
- **Gráficos:** Recharts ou Chart.js

---

## 🚀 Deploy

### Opção 1: Mesma VPS (porta diferente)
```bash
# Na VPS, ao lado do Zap Entregas
docker build -t thonhub .
docker run -d -p 4001:3000 --name thonhub -v hub-data:/data thonhub
```

Nginx:
```nginx
server {
    listen 443 ssl;
    server_name hub.thon.com.br;

    location / {
        proxy_pass http://localhost:4001;
    }
}
```

### Opção 2: VPS separada
- Clonar em servidor diferente
- Configurar DNS separado

---

## ✅ Checklist de Implementação

### Fase 1: Estrutura
- [ ] Criar projeto Next.js
- [ ] Configurar Drizzle + SQLite
- [ ] Implementar schema
- [ ] Criar página de login
- [ ] Criar layout dark theme

### Fase 2: Dashboard
- [ ] Página visão geral
- [ ] Cards de produtos
- [ ] Métricas consolidadas

### Fase 3: Produtos
- [ ] CRUD de produtos
- [ ] Gerar API Keys
- [ ] Página de detalhes por produto

### Fase 4: Asaas
- [ ] Integrar API
- [ ] Webhook endpoint
- [ ] Listar pagamentos
- [ ] Calcular MRR real

### Fase 5: SDK
- [ ] Criar SDK JavaScript
- [ ] Endpoint /api/events
- [ ] Integrar no Zap Entregas

---

## 📞 Contato

Para dúvidas sobre o projeto:
- **Owner:** Thon Black
- **Repo atual:** https://github.com/ThonBlack/Zap-Entregas
- **VPS:** 72.61.135.4 (Hostinger)

---

*Documento gerado em: Janeiro 2026*
*Versão: 1.0*

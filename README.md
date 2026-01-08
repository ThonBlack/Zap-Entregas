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

---

## 🚀 Funcionalidades Implementadas

### ✅ Autenticação
- Login/Registro por telefone + senha
- Roles: `shopkeeper`, `motoboy`, `admin`
- 2FA opcional (TOTP)

### ✅ Dashboard Lojista
- Header com saudação + estatísticas do dia (Pendentes, Em Rota, Feitas)
- Botão "Nova Entrega" destacado
- Lista de entregas pendentes com ações
- Gestão de motoboys
- Resumo financeiro

### ✅ Dashboard Motoboy (Gamificada)
- Header com foto, nível (Bronze/Prata/Ouro), estrelas
- Barra de progresso da meta diária
- Cards de saldo e entregas do dia
- Lista de próximas entregas
- Mensagem de parabéns ao bater meta

### ✅ Rastreio em Tempo Real
- `LocationTracker.tsx` - Envia GPS a cada 10s
- Mapa Leaflet mostrando posição do motoboy
- Página `/tracking/[id]` pública para clientes

### ✅ Otimização de Rotas
- Integração com Google Directions API
- Botão "Otimizar Rota" reorganiza entregas

### ✅ Geofencing
- Botão "Entregue" só libera a 150m do destino
- Usa coordenadas GPS do motoboy

### ✅ Integração WhatsApp
- Botão abre WhatsApp com mensagem pré-definida
- Inclui link de rastreio

### ✅ PWA (App Instalável)
- `manifest.json` com ícones
- `InstallPrompt.tsx` - Notifica usuário para instalar
- Funciona offline (service worker)

### ✅ SaaS & Monetização
- Tabelas `plans` e `subscriptions` no banco
- 5 planos: Grátis, Motoboy Pro, Starter, Growth, Unlimited
- Serviço `asaas.ts` preparado para integração de pagamentos
- **Anúncios** para usuários do plano grátis (`AdBanner.tsx`)
- Página `/upgrade` com landing page completa

### ✅ Painel Admin
- `/admin/saas` - Estatísticas, lista de planos e usuários
- Acesso restrito a `role: admin`

---

## 📁 Estrutura de Diretórios

```
src/
├── app/
│   ├── actions/          # Server Actions (auth, logistics, motoboy, etc)
│   ├── admin/saas/       # Painel admin
│   ├── api/              # API routes
│   ├── deliveries/       # Histórico de entregas
│   ├── finance/          # Gestão financeira
│   ├── login/            # Autenticação
│   ├── motoboys/         # CRUD motoboys
│   ├── routes/           # Nova entrega
│   ├── settings/         # Configurações
│   ├── tracking/         # Rastreio público
│   ├── upgrade/          # Página de planos (Landing Page)
│   └── page.tsx          # Home (dashboard condicional)
├── components/
│   ├── dashboard/        # Views específicas
│   │   ├── ShopkeeperView.tsx
│   │   ├── MotoboyView.tsx
│   │   └── FinancialSummary.tsx
│   ├── ui/               # Componentes base
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── badge.tsx
│   ├── AdBanner.tsx      # Anúncios
│   ├── InstallPrompt.tsx # PWA
│   ├── LocationTracker.tsx
│   └── ...
├── db/
│   ├── index.ts          # Conexão Drizzle
│   └── schema.ts         # Tabelas (users, deliveries, plans, etc)
├── lib/
│   └── routeUtils.ts     # Geocoding e otimização
└── services/
    └── asaas.ts          # Integração pagamentos
```

---

## 🗄️ Banco de Dados (Schema)

### Tabelas Principais:
- `users` - Usuários (lojistas, motoboys, admins)
- `deliveries` - Entregas
- `transactions` - Pagamentos
- `shopSettings` - Configurações do lojista
- `plans` - Planos de assinatura
- `subscriptions` - Assinaturas ativas

---

## 🎨 Identidade Visual

- **Cor principal:** Verde (#22c55e / green-500)
- **Gradientes:** green-500 → emerald-600
- **Logo:** Motoboy com raio (verde)

---

## 📋 Próximos Passos (TODO)

- [ ] Integrar pagamentos Asaas (webhooks)
- [ ] Implementar travas de limites por plano
- [ ] Push notifications para motoboys
- [ ] Modo offline completo
- [ ] Dashboard com gráficos de performance
- [ ] Sistema de avaliação de motoboys

---

## 🚀 Como Rodar

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev -- -p 4000

# Acessar
http://localhost:4000
```

---

## 📞 Contexto para Continuar

Se estiver continuando este projeto com um novo agente/sessão, informe:

> "Estou continuando o Zap Entregas. É um app de entregas com Next.js, Drizzle ORM (SQLite), PWA. Já tem: dashboard gamificada para motoboy, rastreio GPS em tempo real, geofencing, integração WhatsApp, modelo SaaS com planos e página de upgrade. Quero implementar [próxima feature]."

---

*Última atualização: 08/01/2026*

# 🎛️ Dashboard Mestre - Guia de Integração Multi-Produto

> **Objetivo**: Centralizar o gerenciamento de todos os seus produtos digitais em uma única dashboard.

---

## 📊 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎛️ DASHBOARD MESTRE                          │
│     (https://seudominio.com/admin ou app PWA separado)          │
├─────────────────────────────────────────────────────────────────┤
│  📈 Métricas Consolidadas                                       │
│  💰 Faturamento Total (todos produtos)                          │
│  👥 Usuários Ativos (por produto)                               │
│  🔔 Notificações em Tempo Real                                  │
│  ⚙️ Configurações Globais                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ API REST / Webhooks
                           ▼
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  📱 App  │  🛒 Loja │  💻 SaaS │  📦 App  │  🎮 Soft │
│  Play    │  Online  │ (Zap     │  Avulso  │  Desktop │
│  Store   │          │ Entregas)│  (APK)   │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 🔑 Sistema de API Keys

Cada produto recebe uma **Master API Key** única para se conectar à Dashboard:

### Formato da Chave
```
master_{productType}_{productId}_{randomHash}

Exemplos:
- master_saas_zapentregas_a1b2c3d4e5f6...
- master_playstore_meuapp1_x9y8z7w6...
- master_ecommerce_minhaloja_p0o9i8u7...
- master_standalone_software1_m4n5b6v7...
```

### Tipos de Produto Suportados
| Tipo | Código | Descrição |
|------|--------|-----------|
| SaaS Web | `saas` | Aplicações web com assinaturas |
| Play Store | `playstore` | Apps publicados na Google Play |
| E-commerce | `ecommerce` | Lojas online |
| Standalone | `standalone` | Apps/softwares fora de lojas |
| Desktop | `desktop` | Softwares para PC/Mac |

---

## 📡 Endpoints da API de Integração

**Base URL**: `https://zapentregas.duckdns.org/api/master`

### 1️⃣ Registrar Produto
```http
POST /api/master/products
X-ADMIN-KEY: sua-chave-admin
Content-Type: application/json

{
  "name": "Meu App",
  "type": "playstore",
  "packageName": "com.exemplo.meuapp",
  "webhookUrl": "https://meuapp.com/webhook"
}
```

### 2️⃣ Enviar Evento
```http
POST /api/master/events
X-API-KEY: master_playstore_abc123_...
Content-Type: application/json

{
  "event": "purchase",
  "userId": "user123",
  "amount": 29.90,
  "currency": "BRL",
  "metadata": { "plan": "premium" }
}
```

### 3️⃣ Buscar Estatísticas
```http
GET /api/master/stats?period=30d
X-API-KEY: master_playstore_abc123_...
```

---

## 📱 Integração Android

```kotlin
// Inicializar
MasterDashboard.init(apiKey = "master_playstore_...")

// Reportar compra
MasterDashboard.trackPurchase(userId, amount, plan)
```

## 🛒 Integração Loja Online

```javascript
<script src="https://zapentregas.duckdns.org/sdk/master.js"></script>
<script>
  MasterDashboard.init('master_ecommerce_...');
  MasterDashboard.trackPurchase({ orderId, amount });
</script>
```

## 💻 Integração SaaS (Next.js)

```typescript
import { reportMasterEvent } from '@/lib/masterDashboard';
await reportMasterEvent('purchase', { userId, amount, plan });
```

---

*Documento: Guia de Integração Dashboard Mestre v1.0*

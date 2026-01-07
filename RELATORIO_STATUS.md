# Relatório de Status do Projeto: Zap Entregas

## ✅ Funcionalidades Implementadas (Por Painel)

### 🔐 Segurança & Infraestrutra (Todos)
- [x] **Cadastro Público:** Lojistas e Motoboys podem criar conta sozinhos.
- [x] **Login Seguro:** Acesso via celular e senha.
- [x] **2FA (Autenticação de Dois Fatores):** Proteção extra opcional.
- [x] **Deploy Docker:** Sistema rodando isolado e estável na VPS.

---

### 🏪 Painel Lojista (Restaurantes/Comércio)
1.  **Gestão de Entregas:**
    -   [x] **Nova Entrega:** Cadastro rápido com endereço.
    -   [x] **Histórico:** Visualização de entregas passadas.
2.  **Financeiro:**
    -   [x] **Gestor Completo:** Lançamento de Receitas e Despesas (Contas a Pagar/Receber).
    -   [x] **Carteira de Motoboys:** Adicionar Crédito (pagamento) ou Débito (cobrança/retirada) para cada motoboy.
    -   [x] **Resumo de Saldo:** Visualização clara de entradas vs saídas.
3.  **Operacional:**
    -   [x] **Lista de Motoboys:** Visão dos entregadores disponíveis.

---

### 🛵 Painel Motoboy (Entregadores)
1.  **Operacional:**
    -   [x] **Gerador de Rotas:** Seleção de múltiplas entregas pendentes + Link otimizado para Google Maps.
    -   [x] **Histórico Pessoal:** Lista das próprias entregas realizadas.
2.  **Financeiro:**
    -   [x] **Meu Saldo:** Visualiza quanto tem a receber dos lojistas.
    -   [x] **Movimentações:** Extrato de créditos e débitos lançados pelos lojistas.
    -   [x] **Confirmação de Transação:** Pode Aceitar ou Rejeitar um valor lançado pelo lojista (segurança anti-fraude).

---

### 👑 Painel Super Admin (Dono do SaaS)
- [x] **Visão de Deus:** Acesso a todas as funcionalidades do Lojista (para suporte).
- [x] **Gestão de Usuários:** Editar planos (Free/Pro/Enterprise) e dados de usuários.
- [x] **Seed de Admin:** Script para criar/restaurar acesso administrativo.

---

## 🚀 Sugestões de Próximas Funcionalidades (Roadmap)

### 1. 🟢 Integração WhatsApp (Essencial para o nome "Zap")
-   **Notificações Automáticas:** Enviar msg pro cliente quando o motoboy sair ("Seu pedido está a caminho!").
-   **Link de Rastreio:** Enviar localização em tempo real (veja item 2).

### 2. 🗺️ Rastreamento em Tempo Real (Uber Style)
-   Motoboy compartilha loc e o cliente vê iconsizinho se mexendo no mapa.
-   *Complexidade: Alta (WebSockets).*

### 3. 💰 Pagamento Online (Split de Pagamento)
-   Lojista paga via Pix no app.
-   Sistema desconta a taxa do SaaS automaticamente.
-   Repassa o resto pro Motoboy.
-   *Elimina a necessidade de "caderninho" de saldo.*

### 4. 📊 Dashboard de Métricas Avançado
-   "Qual dia vende mais?"
-   "Qual motoboy é mais rápido?"
-   "Lucro líquido mensal descontando entregas."

### 5. 📱 PWA (Instalar como App)
-   Melhorar ícone e manifesto para parecer um app nativo no Android/iOS.
-   Notificações Push no celular.

### 6. 🤖 AI Assistant (Zap Bot)
-   Lojista manda áudio no WhatsApp: "Cria entrega pra Rua X, numero Y".
-   IA transcreve e cadastra no sistema sozinho.

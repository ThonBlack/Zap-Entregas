import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(), // Login principal via telefone
    role: text("role", { enum: ["admin", "shopkeeper", "motoboy"] }).default("motoboy").notNull(),
    password: text("password"), // Opcional se for magic link, mas bom ter para auth simples
    avatarUrl: text("avatar_url"),
    lastAvatarUpdate: text("last_avatar_update"), // Data da última troca de foto
    plan: text("plan", { enum: ["free", "basic", "pro", "growth", "enterprise"] }).default("free").notNull(),
    subscriptionStatus: text("subscription_status", { enum: ["active", "inactive", "trial"] }).default("active").notNull(),
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: integer("two_factor_enabled", { mode: 'boolean' }).default(false),
    currentLat: real("current_lat"),
    currentLng: real("current_lng"),
    lastLocationUpdate: text("last_location_update"),
    dailyGoal: integer("daily_goal").default(10), // Meta diária de entregas do motoboy
    rating: real("rating").default(0), // Média de avaliações gerais (0 = sem avaliação)
    ratingCount: integer("rating_count").default(0), // Quantidade de avaliações gerais
    ratingDelivery: real("rating_delivery").default(0), // Média de avaliações de entrega
    ratingDeliveryCount: integer("rating_delivery_count").default(0), // Quantidade de avaliações de entrega
    trialEndsAt: text("trial_ends_at"), // Data fim do trial (ISO string)
    isTrialUser: integer("is_trial_user", { mode: 'boolean' }).default(false), // Usuário de trial
    apiKey: text("api_key"), // Chave de API para integração com PDV
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const deliveries = sqliteTable("deliveries", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopkeeperId: integer("shopkeeper_id").references(() => users.id),
    motoboyId: integer("motoboy_id").references(() => users.id),
    status: text("status", { enum: ["pending", "assigned", "picked_up", "delivered", "canceled"] }).default("pending").notNull(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    address: text("address").notNull(),
    lat: real("lat"),
    lng: real("lng"),
    value: real("value").default(0), // Valor do pedido (se motoboy precisar cobrar)
    fee: real("fee").default(0), // Taxa de entrega (ganho do motoboy ou custo do lojista)
    observation: text("observation"),
    stopOrder: integer("stop_order"), // Ordem da entrega na rota (1, 2, 3...)
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const transactions = sqliteTable("transactions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull(), // Quem sofreu a alteração de saldo
    amount: real("amount").notNull(),
    type: text("type", { enum: ["credit", "debit"] }).notNull(),
    description: text("description"),
    relatedDeliveryId: integer("related_delivery_id").references(() => deliveries.id),
    creatorId: integer("creator_id").references(() => users.id), // Quem lançou mov
    status: text("status", { enum: ["pending", "confirmed", "rejected"] }).default("confirmed").notNull(), // Default confirmed for old records or same-user actions
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const financialRecords = sqliteTable("financial_records", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull(), // Dono do registro (Lojista)
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    amount: real("amount").notNull(),
    description: text("description").notNull(),
    category: text("category").default("Geral"),
    dueDate: text("due_date").notNull(), // Data de vencimento
    status: text("status", { enum: ["pending", "paid", "overdue"] }).default("pending").notNull(),
    paymentMethod: text("payment_method"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const shopSettings = sqliteTable("shop_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull().unique(), // Configuração única por lojista
    remunerationModel: text("remuneration_model", { enum: ["fixed", "distance", "daily", "hybrid"] }).default("fixed").notNull(),
    fixedValue: real("fixed_value").default(0), // Valor fixo por entrega
    valuePerKm: real("value_per_km").default(0), // Valor por KM
    dailyvalue: real("daily_value").default(0), // Valor da diária
    guaranteedMinimum: real("guaranteed_minimum").default(0), // Mínimo garantido (opcional)
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// RELATIONS
export const usersRelations = relations(users, ({ many, one }) => ({
    shopSettings: one(shopSettings, {
        fields: [users.id],
        references: [shopSettings.userId],
    }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
    shopkeeper: one(users, {
        fields: [deliveries.shopkeeperId],
        references: [users.id],
    }),
    motoboy: one(users, {
        fields: [deliveries.motoboyId],
        references: [users.id],
    }),
}));

export const shopSettingsRelations = relations(shopSettings, ({ one }) => ({
    user: one(users, {
        fields: [shopSettings.userId],
        references: [users.id],
    }),
}));

export const plans = sqliteTable("plans", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(), // Starter, Growth, Unlimited
    price: real("price").notNull(),
    maxMotoboys: integer("max_motoboys").default(1),
    maxDeliveries: integer("max_deliveries").default(50),
    pricePerExtraDelivery: real("price_per_extra_delivery").default(1.0),
    isActive: integer("is_active", { mode: 'boolean' }).default(true),
});

export const subscriptions = sqliteTable("subscriptions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id).notNull(),
    planId: integer("plan_id").references(() => plans.id).notNull(),
    asaasCustomerId: text("asaas_customer_id"),
    asaasSubscriptionId: text("asaas_subscription_id"),
    status: text("status", { enum: ["active", "overdue", "canceled"] }).default("active"),
    currentPeriodStart: text("current_period_start"),
    currentPeriodEnd: text("current_period_end"),
    usageCount: integer("usage_count").default(0), // Count deliveries in cycle
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    user: one(users, {
        fields: [subscriptions.userId],
        references: [users.id],
    }),
    plan: one(plans, {
        fields: [subscriptions.planId],
        references: [plans.id],
    }),
}));

// Tabela de Avaliações
export const reviews = sqliteTable("reviews", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
    motoboyId: integer("motoboy_id").references(() => users.id).notNull(),
    shopkeeperId: integer("shopkeeper_id").references(() => users.id),
    customerName: text("customer_name"),
    ratingGeneral: integer("rating_general").notNull(), // 1-5 estrelas - avaliação geral
    ratingDelivery: integer("rating_delivery").notNull(), // 1-5 estrelas - avaliação da entrega
    feedback: text("feedback"), // Comentário/sugestão do cliente
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
    delivery: one(deliveries, {
        fields: [reviews.deliveryId],
        references: [deliveries.id],
    }),
    motoboy: one(users, {
        fields: [reviews.motoboyId],
        references: [users.id],
    }),
}));

// =========================================
// DASHBOARD MESTRE - Multi-Produto
// =========================================

export const masterProducts = sqliteTable("master_products", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(), // Nome do produto
    type: text("type", {
        enum: ["saas", "playstore", "ecommerce", "standalone", "desktop"]
    }).notNull(),
    description: text("description"),
    packageName: text("package_name"), // Para apps (com.example.app)
    webhookUrl: text("webhook_url"), // URL para notificações
    apiKey: text("api_key").notNull().unique(), // Chave única do produto
    isActive: integer("is_active", { mode: 'boolean' }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const masterEvents = sqliteTable("master_events", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").references(() => masterProducts.id).notNull(),
    event: text("event", {
        enum: ["signup", "login", "purchase", "cancel", "refund", "error", "custom"]
    }).notNull(),
    userId: text("user_id"), // ID do usuário no produto (pode ser string ou número)
    amount: real("amount"), // Valor se for transação
    currency: text("currency").default("BRL"),
    metadata: text("metadata"), // JSON com dados extras
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const masterProductsRelations = relations(masterProducts, ({ many }) => ({
    events: many(masterEvents),
}));

export const masterEventsRelations = relations(masterEvents, ({ one }) => ({
    product: one(masterProducts, {
        fields: [masterEvents.productId],
        references: [masterProducts.id],
    }),
}));

// Configurações de notificação do admin
export const masterNotificationSettings = sqliteTable("master_notification_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventType: text("event_type").notNull(), // signup, purchase, cancel, etc.
    enablePush: integer("enable_push", { mode: 'boolean' }).default(true),
    enableEmail: integer("enable_email", { mode: 'boolean' }).default(false),
    enableWhatsapp: integer("enable_whatsapp", { mode: 'boolean' }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Logs de eventos e erros para monitoramento em produção
export const appLogs = sqliteTable("app_logs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    level: text("level", { enum: ["info", "warn", "error", "debug"] }).default("info").notNull(),
    event: text("event").notNull(), // Nome do evento (ex: "delivery_created", "login_error")
    message: text("message"), // Descrição do evento/erro
    userId: integer("user_id"), // ID do usuário relacionado (opcional)
    page: text("page"), // Página onde ocorreu (ex: "/routes/new")
    userAgent: text("user_agent"), // Browser/dispositivo
    ip: text("ip"), // IP do usuário
    metadata: text("metadata"), // JSON com dados extras
    stack: text("stack"), // Stack trace se for erro
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

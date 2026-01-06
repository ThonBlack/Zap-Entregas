import { db } from "./index";
import { users, deliveries, transactions } from "./schema";
import { eq } from "drizzle-orm";

async function simulate() {
    console.log("🚀 Iniciando Simulação...");

    // 1. Garantir Lojista
    let shopkeeper = await db.query.users.findFirst({
        where: eq(users.role, "shopkeeper")
    });

    if (!shopkeeper) {
        console.log("Criando Lojista de Teste...");
        const res = await db.insert(users).values({
            name: "Lojista Demo",
            phone: "999999999",
            password: "123",
            role: "shopkeeper"
        }).returning();
        shopkeeper = res[0];
    }

    // 2. Criar Motoboy "Carlos Relâmpago"
    console.log("🏍️ Criando Motoboy Carlos...");
    const motoboyRes = await db.insert(users).values({
        name: "Carlos Relâmpago",
        phone: "11977776666",
        password: "123",
        role: "motoboy",
        avatarUrl: "https://i.pravatar.cc/150?u=carlos", // Foto fake
        lastAvatarUpdate: new Date().toISOString()
    }).returning();
    const carlos = motoboyRes[0];

    // 3. Criar uma Rota com 3 Entregas (Simulando geocoding já resolvido)
    console.log("📦 Criando Rota para Carlos...");

    const route = [
        {
            address: "Av. Paulista, 1578 - Bela Vista, São Paulo - SP",
            customerName: "Museu de Arte (MASP)",
            customerPhone: "1133334444",
            value: 15.00,
            status: "pending",
            stopOrder: 1,
            lat: -23.561414,
            lng: -46.6558819,
            observation: "Entregar na bilheteria"
        },
        {
            address: "Rua Augusta, 1000 - Consolação, São Paulo - SP",
            customerName: "Bar do Zé",
            customerPhone: "11999998888",
            value: 22.50,
            status: "pending",
            stopOrder: 2,
            lat: -23.553974,
            lng: -46.655794,
            observation: "Tocar interfone 10"
        },
        {
            address: "Parque Ibirapuera, Portão 3 - SP",
            customerName: "Ana Atleta",
            customerPhone: "11988887777",
            value: 0.00, // Já pago
            status: "pending",
            stopOrder: 3,
            lat: -23.587416,
            lng: -46.657634,
            observation: "Cuidado com o cachorro"
        }
    ];

    for (const stop of route) {
        await db.insert(deliveries).values({
            shopkeeperId: shopkeeper.id,
            motoboyId: carlos.id, // Já atribuído ao Carlos? Ou pending? Vamos atribuir pra simular ele vendo.
            // Se o sistema atual não suporta atribuição direta na criação, isso vai direto pro banco.
            // Mas nossa UI Motoboy pega TUDO que é pending. Então ok.
            ...stop,
            status: "pending" as const
        });
    }

    // 4. Lançar Financeiro
    console.log("💰 Lançando Transações Financeiras...");

    // Pagamento: Lojista deu R$ 50 de gasolina
    await db.insert(transactions).values({
        userId: carlos.id,
        amount: 50.00,
        type: "credit",
        description: "Adiantamento Gasolina"
    });

    // Recebimento: Motoboy entregou R$ 120,00 de pedidos anteriores
    await db.insert(transactions).values({
        userId: carlos.id,
        amount: 120.00,
        type: "debit",
        description: "Acerto de Entregas (Ontem)"
    });

    console.log("✅ Simulação Concluída!");
    console.log(`Logue como Motoboy: ${carlos.phone} / 123`);
    console.log(`Logue como Lojista: ${shopkeeper.phone} / 123`);
}

simulate().catch(console.error);

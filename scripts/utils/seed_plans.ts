import { db } from "../../src/db";
import { plans } from "../../src/db/schema";
import { eq } from "drizzle-orm";

/**
 * Popula/atualiza a tabela de planos com os 5 tiers oficiais.
 * Alinhado com PLAN_PRICES em admin/page.tsx e com a landing.
 *
 * Uso: npx tsx scripts/utils/seed_plans.ts
 */

const SEED = [
    { name: "Free", price: 0, maxMotoboys: 1, maxDeliveries: 30, pricePerExtraDelivery: 0, isActive: true },
    { name: "Basic", price: 19.90, maxMotoboys: 3, maxDeliveries: 150, pricePerExtraDelivery: 0.8, isActive: true },
    { name: "Pro", price: 49.90, maxMotoboys: 10, maxDeliveries: 500, pricePerExtraDelivery: 0.6, isActive: true },
    { name: "Growth", price: 79.90, maxMotoboys: 25, maxDeliveries: 1500, pricePerExtraDelivery: 0.4, isActive: true },
    { name: "Enterprise", price: 199.90, maxMotoboys: 999, maxDeliveries: 99999, pricePerExtraDelivery: 0, isActive: true },
];

async function seed() {
    console.log("Seeding plans (upsert por nome)...");
    for (const p of SEED) {
        const existing = await db.select().from(plans).where(eq(plans.name, p.name)).get();
        if (existing) {
            await db.update(plans).set(p).where(eq(plans.id, existing.id));
            console.log(`  atualizado: ${p.name} (R$ ${p.price})`);
        } else {
            await db.insert(plans).values(p);
            console.log(`  criado: ${p.name} (R$ ${p.price})`);
        }
    }
    console.log("Done!");
    process.exit(0);
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
});

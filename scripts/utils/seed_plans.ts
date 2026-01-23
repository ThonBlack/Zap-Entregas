
import { db } from "./src/db";
import { plans } from "./src/db/schema";

async function seed() {
    console.log("Seeding Plans...");

    await db.insert(plans).values([
        { name: "Grátis (Motoboy)", price: 0, maxMotoboys: 1, maxDeliveries: 1000, pricePerExtraDelivery: 0, isActive: true },
        { name: "Motoboy Pro", price: 19.90, maxMotoboys: 1, maxDeliveries: 99999, pricePerExtraDelivery: 0, isActive: true },
        { name: "Starter (Lojista)", price: 39.90, maxMotoboys: 1, maxDeliveries: 50, pricePerExtraDelivery: 1.0, isActive: true },
        { name: "Growth (Lojista)", price: 69.90, maxMotoboys: 3, maxDeliveries: 100, pricePerExtraDelivery: 0.8, isActive: true },
        { name: "Unlimited", price: 149.90, maxMotoboys: 999, maxDeliveries: 99999, pricePerExtraDelivery: 0, isActive: true },
    ]);

    console.log("Done!");
    process.exit(0);
}

seed();

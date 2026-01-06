import { db } from "./index";
import { users, transactions } from "./schema";

async function main() {
    console.log("Seeding database...");
    try {
        // Check if users exist
        const allUsers = await db.select().from(users);

        if (allUsers.length === 0) {
            await db.insert(users).values([
                { name: "Lojista Demo", phone: "999999999", role: "shopkeeper", password: "123" },
                { name: "Motoboy Fast", phone: "888888888", role: "motoboy", password: "123" },
            ]);
            console.log("Users created.");
        }

        const motoboy = await db.query.users.findFirst({ where: (users, { eq }) => eq(users.role, 'motoboy') });

        if (motoboy) {
            // Create some transactions
            await db.insert(transactions).values([
                { userId: motoboy.id, amount: 20.00, type: 'credit', description: 'Corrida #101' },
                { userId: motoboy.id, amount: 15.50, type: 'credit', description: 'Corrida #102' },
                { userId: motoboy.id, amount: 40.00, type: 'debit', description: 'Recebido do Cliente #102' },
            ]);
            console.log("Transactions created.");
        }

        console.log("Seed done!");
    } catch (e) {
        console.error("Seed error:", e);
    }
}

main();

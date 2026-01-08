import axios from "axios";

const ASAAS_API_URL = process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

const asaas = axios.create({
    baseURL: ASAAS_API_URL,
    headers: {
        access_token: ASAAS_API_KEY
    }
});

export async function createAsaasCustomer(name: string, cpfCnpj: string, email: string) {
    if (!ASAAS_API_KEY) return { id: "mock_id" }; // Fallback for dev without key

    try {
        // Build payload
        const response = await asaas.post('/customers', {
            name,
            cpfCnpj,
            email
        });
        return response.data;
    } catch (error: any) {
        console.error("Asaas Create Customer Error", error.response?.data || error.message);
        throw new Error("Falha ao criar cliente no Asaas");
    }
}

export async function createSubscription(customerId: string, value: number, description: string) {
    if (!ASAAS_API_KEY) return { id: "mock_sub_id", status: "ACTIVE" };

    try {
        const response = await asaas.post('/subscriptions', {
            customer: customerId,
            billingType: "CREDIT_CARD", // Or UNDEFINED to let user choose
            value,
            nextDueDate: new Date().toISOString().split('T')[0], // Today
            cycle: "MONTHLY",
            description
        });
        return response.data;
    } catch (error: any) {
        console.error("Asaas Create Subscription Error", error.response?.data || error.message);
        throw new Error("Falha ao criar assinatura");
    }
}

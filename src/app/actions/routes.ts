"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { newTrackingToken } from "@/lib/trackingToken";
import { pushToMotoboys } from "@/lib/push";
import { parseMoney } from "@/lib/money";
import { existeCorridaIgualRecente } from "@/lib/deliveryGuards";

/** Teto de paradas numa rota só (cada uma é uma busca de endereço no mapa). */
const MAX_ENDERECOS_POR_ROTA = 30;

export async function createRouteAction(prevState: any, formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    const addresses = formData.getAll("address");
    const names = formData.getAll("name");
    const values = formData.getAll("value");
    const phones = formData.getAll("customerPhone");
    const observations = formData.getAll("observation");

    if (!addresses.length) return { error: "Adicione ao menos um endereço" };

    // Cada endereço vira uma busca no mapa (Google + até 3 tentativas no
    // OpenStreetMap, com 1,1s de espera entre elas). Sem teto, uma lista grande
    // segura o processo inteiro por horas — o app é um Node só.
    if (addresses.length > MAX_ENDERECOS_POR_ROTA) {
        return { error: `Máximo de ${MAX_ENDERECOS_POR_ROTA} endereços por rota. Divida em duas.` };
    }

    // Mesma trava do cadastro avulso (addDeliveryAction): plano no limite não cria rota.
    // Aqui comparamos com QUANTOS endereços vêm — antes bastava sobrar 1 vaga
    // pra passar uma rota de 20 paradas.
    const { canCreateDelivery } = await import("@/lib/planLimits");
    const limitCheck = await canCreateDelivery(me.id);
    if (!limitCheck.allowed) {
        return { error: limitCheck.reason || "Limite de entregas atingido." };
    }
    if (typeof limitCheck.remaining === "number" && addresses.length > limitCheck.remaining) {
        return {
            error: `Seu plano tem só ${limitCheck.remaining} entrega(s) restantes este mês e essa rota tem ${addresses.length}. Faça upgrade ou tire endereços da lista.`,
        };
    }

    if (await existeCorridaIgualRecente(me.id, addresses[0] as string, 1)) {
        return { error: "Rota já criada recentemente. Aguarde um momento." };
    }

    const shopCfg = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, me.id),
        columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
    });
    const geoOpts = {
        defaultCity: shopCfg?.defaultCity ?? null,
        defaultState: shopCfg?.defaultState ?? null,
        shopLat: shopCfg?.shopLat ?? null,
        shopLng: shopCfg?.shopLng ?? null,
    };

    // Campo de valor é texto (o celular manda "12,50"): vira número aqui.
    // Vazio é zero; texto ilegível derruba a rota inteira com erro na tela, em
    // vez de gravar R$ 0,00 calado (ou R$ 1,85 pra quem digitou "1.850,00").
    const valoresLidos: number[] = [];
    for (let i = 0; i < addresses.length; i++) {
        const texto = String(values[i] ?? "").trim();
        const n = texto ? parseMoney(texto) : 0;
        if (n === null || n < 0) {
            return { error: `Valor inválido no endereço ${i + 1}. Escreva assim: 12,50` };
        }
        valoresLidos.push(n);
    }
    const lerValor = (indice: number) => valoresLidos[indice] ?? 0;

    const points = await Promise.all(addresses.map(async (addr, index) => {
        const coords = await geocodeAddress(addr as string, geoOpts);
        return {
            index,
            address: addr as string,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
        };
    }));

    const validPoints = points.filter(p => p.lat !== 0);
    const optimizedPath = validPoints.length > 0
        ? optimizeRoute(validPoints[0], validPoints)
        : points;

    // Data sempre em ISO (o CURRENT_TIMESTAMP do banco grava noutro formato e as
    // duas formas juntas quebram comparação e ordenação).
    const agora = new Date().toISOString();

    const newDeliveries = optimizedPath.map((p, i) => {
        const originalIndex = p.index;
        return {
            createdAt: agora,
            updatedAt: agora,
            shopkeeperId: me.id,
            address: addresses[originalIndex] as string,
            customerName: names[originalIndex] as string,
            customerPhone: phones[originalIndex] as string,
            observation: observations[originalIndex] as string,
            value: lerValor(originalIndex),
            status: "pending" as const,
            stopOrder: i + 1,
            lat: p.lat,
            lng: p.lng,
            publicToken: newTrackingToken(),
        };
    });

    // Quando NENHUM endereço geocodificou, optimizedPath já é a lista inteira —
    // repetir os que falharam duplicaria todas as corridas.
    const failedPoints = validPoints.length ? points.filter(p => p.lat === 0) : [];
    failedPoints.forEach((p, i) => {
        newDeliveries.push({
            createdAt: agora,
            updatedAt: agora,
            shopkeeperId: me.id,
            address: addresses[p.index] as string,
            customerName: names[p.index] as string,
            customerPhone: phones[p.index] as string,
            observation: observations[p.index] as string,
            value: lerValor(p.index),
            status: "pending" as const,
            stopOrder: optimizedPath.length + i + 1,
            lat: 0,
            lng: 0,
            publicToken: newTrackingToken(),
        });
    });

    await db.insert(deliveries).values(newDeliveries);

    pushToMotoboys({
        title: newDeliveries.length > 1 ? "🔥 Várias Corridas Novas!" : "🏍️ Nova Corrida Disponível!",
        body: newDeliveries.length > 1
            ? `${newDeliveries.length} entregas aguardando`
            : newDeliveries[0].address,
        url: "/app",
        tag: "nova-corrida",
    }).catch(() => { });

    redirect("/app");
}

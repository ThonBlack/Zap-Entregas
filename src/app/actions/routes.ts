"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { newTrackingToken } from "@/lib/trackingToken";
import { pushDeCorridaNova, pushDeCorridaDestinada } from "@/lib/push";
import { parseMoney } from "@/lib/money";
import { existeCorridaIgualRecente } from "@/lib/deliveryGuards";
import { avisoDeCorridaNova, resumoDoLocal } from "@/lib/deliveryPrivacy";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { normalizarChargeMode, type ChargeMode } from "@/lib/chargeMode";

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
    const cobrancas = formData.getAll("chargeMode");

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
    //
    // O tipo de cobrança ("Receber na entrega" × "Conferir Pix da loja" × "Já
    // pago") vem em paralelo, um por endereço. "Já pago" zera o valor.
    const valoresLidos: number[] = [];
    const cobrancasLidas: ChargeMode[] = [];
    for (let i = 0; i < addresses.length; i++) {
        const modo = normalizarChargeMode(cobrancas[i], null);
        const texto = String(values[i] ?? "").trim();
        const n = modo === "pago" ? 0 : (texto ? parseMoney(texto) : 0);
        if (n === null || n < 0) {
            return { error: `Valor inválido no endereço ${i + 1}. Escreva assim: 12,50` };
        }
        valoresLidos.push(n);
        cobrancasLidas.push(modo);
    }
    const lerValor = (indice: number) => valoresLidos[indice] ?? 0;
    const lerCobranca = (indice: number): ChargeMode => cobrancasLidas[indice] ?? "pago";

    // Destinar a rota inteira a um motoboy é opcional: vazio = fila aberta.
    const motoboyIdBruto = String(formData.get("motoboyId") ?? "").trim();
    let destinatario: { id: number; name: string } | null = null;
    if (motoboyIdBruto) {
        const escolhido = await carregarMotoboyGerenciado(me, Number(motoboyIdBruto));
        if (!escolhido) return { error: "Esse motoboy não é da sua equipe." };
        destinatario = { id: escolhido.id, name: escolhido.name };
    }

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

    /** Uma parada, do jeito que vai pro banco. Destinada a alguém já nasce "aceita". */
    const montar = (originalIndex: number, ordem: number, lat: number, lng: number) => ({
        createdAt: agora,
        updatedAt: agora,
        shopkeeperId: me.id,
        motoboyId: destinatario?.id ?? null,
        address: addresses[originalIndex] as string,
        customerName: names[originalIndex] as string,
        customerPhone: phones[originalIndex] as string,
        observation: destinatario
            ? [observations[originalIndex] as string, `destinada pela loja a ${destinatario.name}`]
                .filter(Boolean).join(" · ").slice(0, 1000)
            : (observations[originalIndex] as string),
        value: lerValor(originalIndex),
        chargeMode: lerCobranca(originalIndex),
        status: (destinatario ? "assigned" : "pending") as "assigned" | "pending",
        acceptedAt: destinatario ? agora : null,
        stopOrder: ordem,
        lat,
        lng,
        publicToken: newTrackingToken(),
    });

    const newDeliveries = optimizedPath.map((p, i) => montar(p.index, i + 1, p.lat, p.lng));

    // Quando NENHUM endereço geocodificou, optimizedPath já é a lista inteira —
    // repetir os que falharam duplicaria todas as corridas.
    const failedPoints = validPoints.length ? points.filter(p => p.lat === 0) : [];
    failedPoints.forEach((p, i) => {
        newDeliveries.push(montar(p.index, optimizedPath.length + i + 1, 0, 0));
    });

    const criadas = await db.insert(deliveries).values(newDeliveries)
        .returning({ id: deliveries.id });

    if (destinatario) {
        // Corrida com dono não vira anúncio pro pool: só o escolhido é avisado,
        // e sem endereço com número no corpo do push (é dado do cliente).
        pushDeCorridaDestinada(
            destinatario.id,
            criadas[0]?.id ?? 0,
            newDeliveries.length > 1
                ? `${newDeliveries.length} entregas pra você`
                : resumoDoLocal(newDeliveries[0].address),
            me.name,
        ).catch(() => { });
    } else {
        // Só quem pode VER essas corridas é avisado (regra única em team.ts).
        pushDeCorridaNova(me.id, {
            title: newDeliveries.length > 1 ? "🔥 Várias Corridas Novas!" : "🏍️ Nova Corrida Disponível!",
            body: newDeliveries.length > 1
                ? `${newDeliveries.length} entregas aguardando`
                // Endereço cru no push é dado pessoal do cliente saindo pro
                // celular de motoboy de qualquer loja — vai só o bairro.
                : avisoDeCorridaNova(newDeliveries[0].address),
            url: "/app",
            tag: "nova-corrida",
        }).catch(() => { });
    }

    redirect("/app");
}

import { NextRequest, NextResponse } from "next/server";
import { autorizarBuscaDeEndereco } from "@/lib/placesAuth";
import { aplicarLimite } from "@/lib/rateLimit";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    // Esta rota gasta a chave paga do Google. Só quem está logado — ou o caixa
    // com o código de conferência do PDV, ou o vendedor com o código da fila da
    // loja — pode chamar.
    const quem = await autorizarBuscaDeEndereco(
        searchParams.get("confirmToken"),
        searchParams.get("filaToken"),
    );
    if (!quem.autorizado) {
        return NextResponse.json({ error: "Faça login para buscar endereços." }, { status: 401 });
    }
    const limite = aplicarLimite("places", quem.chave);
    if (!limite.permitido) {
        return NextResponse.json(
            { error: "Muitas buscas seguidas. Espere alguns segundos." },
            { status: 429, headers: { "Retry-After": String(limite.esperarSegundos) } }
        );
    }

    if (!query) {
        return NextResponse.json({ error: "Query é obrigatória" }, { status: 400 });
    }

    // Sem chave não é erro: o cliente cai no OpenStreetMap sozinho.
    if (!GOOGLE_MAPS_API_KEY) {
        return NextResponse.json({ predictions: [], disabled: true });
    }

    try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
        url.searchParams.append("input", query);
        url.searchParams.append("key", GOOGLE_MAPS_API_KEY);
        url.searchParams.append("language", "pt-BR");
        url.searchParams.append("components", "country:br"); // Restringir ao Brasil
        // Sem filtro de tipo de propósito: metade dos pedidos chega como ponto de
        // referência ("Faculdade FAZU", "Conjunto Antônio Barbosa"), que "types=address" esconderia.

        // Puxa resultados pra perto da loja, quando o chamador informa onde ela fica.
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");
        if (lat && lng) {
            url.searchParams.append("location", `${lat},${lng}`);
            url.searchParams.append("radius", "50000");
        }

        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
            return NextResponse.json({ predictions: data.predictions || [] });
        } else {
            // O `error_message` do Google conta demais (estado da chave, cota,
            // faturamento). Isso fica no log do servidor; pra quem chamou vai só
            // "não deu" — o campo cai sozinho no OpenStreetMap.
            console.error("Google Places API error:", data.status, data.error_message);
            return NextResponse.json({ error: "Não foi possível buscar o endereço agora." }, { status: 400 });
        }
    } catch (error) {
        console.error("Erro ao buscar autocomplete:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

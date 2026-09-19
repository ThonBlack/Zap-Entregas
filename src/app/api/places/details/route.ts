import { NextRequest, NextResponse } from "next/server";
import { autorizarBuscaDeEndereco } from "@/lib/placesAuth";
import { aplicarLimite } from "@/lib/rateLimit";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

    // Mesma tranca do autocomplete: a chave paga do Google não fica aberta.
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

    if (!placeId) {
        return NextResponse.json({ error: "place_id é obrigatório" }, { status: 400 });
    }

    if (!GOOGLE_MAPS_API_KEY) {
        return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        url.searchParams.append("place_id", placeId);
        url.searchParams.append("key", GOOGLE_MAPS_API_KEY);
        url.searchParams.append("fields", "geometry,formatted_address");
        url.searchParams.append("language", "pt-BR");

        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.status === "OK") {
            return NextResponse.json({ result: data.result });
        } else {
            // Detalhe do erro fica no log, não na resposta (ver autocomplete).
            console.error("Google Places Details error:", data.status, data.error_message);
            return NextResponse.json({ error: "Não foi possível buscar o endereço agora." }, { status: 400 });
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

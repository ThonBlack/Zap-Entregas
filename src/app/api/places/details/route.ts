import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

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
            console.error("Google Places Details error:", data.status);
            return NextResponse.json({ error: data.error_message || "Erro na API" }, { status: 400 });
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

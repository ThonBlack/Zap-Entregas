import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
        return NextResponse.json({ error: "Query é obrigatória" }, { status: 400 });
    }

    if (!GOOGLE_MAPS_API_KEY) {
        return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
        url.searchParams.append("input", query);
        url.searchParams.append("key", GOOGLE_MAPS_API_KEY);
        url.searchParams.append("language", "pt-BR");
        url.searchParams.append("components", "country:br"); // Restringir ao Brasil
        url.searchParams.append("types", "address"); // Apenas endereços

        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
            return NextResponse.json({ predictions: data.predictions || [] });
        } else {
            console.error("Google Places API error:", data.status, data.error_message);
            return NextResponse.json({ error: data.error_message || "Erro na API" }, { status: 400 });
        }
    } catch (error) {
        console.error("Erro ao buscar autocomplete:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

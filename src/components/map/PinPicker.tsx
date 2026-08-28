"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { chaveDoGoogleFoiRecusada } from "./googleMapsLoader";
import type { PinPickerProps } from "./mapTypes";

// Só um dos dois mapas vai pro navegador: o Leaflet nem baixa quando o Google abre.
const GooglePinPicker = dynamic(() => import("./GooglePinPicker"), {
    ssr: false,
    loading: () => <EsqueletoDoMapa />,
});
const LeafletPinPicker = dynamic(() => import("./LeafletPinPicker"), {
    ssr: false,
    loading: () => <EsqueletoDoMapa />,
});

function EsqueletoDoMapa() {
    return (
        <div className="h-[300px] w-full bg-zinc-100 rounded-xl animate-pulse flex items-center justify-center text-zinc-400 text-sm">
            Carregando mapa…
        </div>
    );
}

/**
 * Escolhe o mapa da conferência: Google quando existe chave do navegador
 * (acha ruas de Uberaba que o OpenStreetMap não tem), OpenStreetMap de reserva.
 *
 * A regra é nunca deixar a tela sem mapa: sem chave, sem rede ou com chave
 * recusada, cai no Leaflet sozinho.
 */
export default function PinPicker(props: PinPickerProps) {
    const chave = props.googleMapsKey?.trim() || "";
    // Guardamos QUAL chave falhou: se o servidor mandar outra, vale tentar de novo.
    const [chaveQueFalhou, setChaveQueFalhou] = useState<string | null>(null);
    const caiuPraOsm = chaveQueFalhou !== null && chaveQueFalhou === chave;

    if (!chave || caiuPraOsm || chaveDoGoogleFoiRecusada()) {
        return <LeafletPinPicker {...props} />;
    }

    return (
        <GooglePinPicker
            {...props}
            googleMapsKey={chave}
            onFalha={() => setChaveQueFalhou(chave)}
        />
    );
}

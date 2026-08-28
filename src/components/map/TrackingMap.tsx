"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { chaveDoGoogleFoiRecusada } from "./googleMapsLoader";
import type { TrackingMapProps } from "./mapTypes";

const GoogleTrackingMap = dynamic(() => import("./GoogleTrackingMap"), {
    ssr: false,
    loading: () => <EsqueletoDoMapa />,
});
const LeafletTrackingMap = dynamic(() => import("./LeafletTrackingMap"), {
    ssr: false,
    loading: () => <EsqueletoDoMapa />,
});

function EsqueletoDoMapa() {
    return (
        <div className="h-[400px] w-full bg-zinc-100 rounded-xl animate-pulse flex items-center justify-center text-zinc-400">
            Carregando Mapa...
        </div>
    );
}

/** Mesma escolha do PinPicker: Google quando dá, OpenStreetMap de reserva. */
export default function TrackingMap(props: TrackingMapProps) {
    const chave = props.googleMapsKey?.trim() || "";
    // Guardamos QUAL chave falhou: se o servidor mandar outra, vale tentar de novo.
    const [chaveQueFalhou, setChaveQueFalhou] = useState<string | null>(null);
    const caiuPraOsm = chaveQueFalhou !== null && chaveQueFalhou === chave;

    if (!chave || caiuPraOsm || chaveDoGoogleFoiRecusada()) {
        return <LeafletTrackingMap {...props} />;
    }

    return (
        <GoogleTrackingMap
            {...props}
            googleMapsKey={chave}
            onFalha={() => setChaveQueFalhou(chave)}
        />
    );
}

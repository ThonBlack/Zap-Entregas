"use client";

import { useEffect, useRef, useState } from "react";
import {
    carregarGoogleMaps,
    aoRecusarChaveDoGoogle,
    type GMapa,
    type GMarcador,
    type GoogleMapsApi,
} from "./googleMapsLoader";
import type { PinPickerProps } from "./mapTypes";

interface GooglePinPickerProps extends PinPickerProps {
    googleMapsKey: string;
    /** Deu ruim (rede, chave recusada, demora): o pai troca pro Leaflet. */
    onFalha: () => void;
}

/**
 * Mesma tela do PinPicker antigo, desenhada pelo Google.
 * Motivo da troca: o OpenStreetMap não tem várias ruas de Uberaba; o Google tem.
 */
export default function GooglePinPicker({
    lat, lng, onMove, recenterTrigger = 0, shopLat, shopLng, googleMapsKey, onFalha,
}: GooglePinPickerProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const mapaRef = useRef<GMapa | null>(null);
    const pinoRef = useRef<GMarcador | null>(null);
    const lojaRef = useRef<GMarcador | null>(null);
    const apiRef = useRef<GoogleMapsApi | null>(null);
    const [pronto, setPronto] = useState(false);

    // onMove por ref: trocar o callback não pode recriar o mapa (perderia o zoom).
    const onMoveRef = useRef(onMove);
    useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
    const onFalhaRef = useRef(onFalha);
    useEffect(() => { onFalhaRef.current = onFalha; }, [onFalha]);

    // Posição inicial fixada na 1ª montagem: depois quem manda no mapa é o usuário.
    const inicialRef = useRef({ lat, lng });

    useEffect(() => aoRecusarChaveDoGoogle(() => onFalhaRef.current()), []);

    useEffect(() => {
        let vivo = true;

        carregarGoogleMaps(googleMapsKey)
            .then((maps) => {
                if (!vivo || !divRef.current) return;

                const mapa = new maps.Map(divRef.current, {
                    center: inicialRef.current,
                    zoom: 16,
                    scrollwheel: false,
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    // "cooperative": um dedo rola a PÁGINA, dois dedos mexem no mapa.
                    // Com "greedy" o mapa capturava o arrasto de um dedo só e o caixa
                    // ficava preso nele, sem conseguir chegar nos campos de baixo.
                    gestureHandling: "cooperative",
                });

                const pino = new maps.Marker({
                    map: mapa,
                    position: inicialRef.current,
                    draggable: true,
                });

                pino.addListener("dragend", () => {
                    const p = pino.getPosition();
                    if (p) onMoveRef.current(p.lat(), p.lng());
                });

                // Tocar no mapa também move o pino — no celular é mais fácil que arrastar.
                mapa.addListener("click", (e) => {
                    const p = e.latLng;
                    if (!p) return;
                    pino.setPosition({ lat: p.lat(), lng: p.lng() });
                    onMoveRef.current(p.lat(), p.lng());
                });

                apiRef.current = maps;
                mapaRef.current = mapa;
                pinoRef.current = pino;
                setPronto(true);
            })
            .catch((erro) => {
                console.warn("[mapa] caindo pro OpenStreetMap:", erro?.message ?? erro);
                if (vivo) onFalhaRef.current();
            });

        return () => {
            vivo = false;
            pinoRef.current?.setMap(null);
            lojaRef.current?.setMap(null);
            pinoRef.current = null;
            lojaRef.current = null;
            mapaRef.current = null;
        };
    }, [googleMapsKey]);

    // Endereço mudou por fora (escolha no autocomplete): pino e câmera acompanham.
    useEffect(() => {
        if (!pronto) return;
        pinoRef.current?.setPosition({ lat, lng });
    }, [pronto, lat, lng]);

    useEffect(() => {
        if (!pronto || recenterTrigger <= 0) return;
        const mapa = mapaRef.current;
        if (!mapa) return;
        mapa.setCenter({ lat, lng });
        if ((mapa.getZoom() ?? 0) < 16) mapa.setZoom(16);
    }, [pronto, recenterTrigger, lat, lng]);

    // Bolinha verde da loja, pra dar referência de distância.
    useEffect(() => {
        if (!pronto) return;
        const mapa = mapaRef.current;
        const api = apiRef.current;
        if (!mapa || !api) return;

        lojaRef.current?.setMap(null);
        lojaRef.current = null;

        if (shopLat == null || shopLng == null || shopLat === 0 || shopLng === 0) return;

        lojaRef.current = new api.Marker({
            map: mapa,
            position: { lat: shopLat, lng: shopLng },
            clickable: false,
            icon: {
                path: api.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#16a34a",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
            },
        });
    }, [pronto, shopLat, shopLng]);

    return (
        <div className="relative h-[300px] w-full rounded-xl overflow-hidden z-0">
            <div ref={divRef} className="h-full w-full" />
            {!pronto && (
                <div className="absolute inset-0 bg-zinc-100 animate-pulse flex items-center justify-center text-zinc-400 text-sm">
                    Carregando mapa…
                </div>
            )}
        </div>
    );
}

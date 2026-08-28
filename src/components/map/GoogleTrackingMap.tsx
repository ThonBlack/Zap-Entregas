"use client";

import { useEffect, useRef, useState } from "react";
import {
    carregarGoogleMaps,
    aoRecusarChaveDoGoogle,
    type GMapa,
    type GMarcador,
} from "./googleMapsLoader";
import type { TrackingMapProps } from "./mapTypes";

interface GoogleTrackingMapProps extends TrackingMapProps {
    googleMapsKey: string;
    onFalha: () => void;
}

const ICONE_MOTOBOY = "https://cdn-icons-png.flaticon.com/512/1986/1986937.png";

/** Rastreio do cliente desenhado pelo Google (mesmo mapa da conferência). */
export default function GoogleTrackingMap({ motoboyLocation, googleMapsKey, onFalha }: GoogleTrackingMapProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const mapaRef = useRef<GMapa | null>(null);
    const motoRef = useRef<GMarcador | null>(null);
    const [pronto, setPronto] = useState(false);

    const onFalhaRef = useRef(onFalha);
    useEffect(() => { onFalhaRef.current = onFalha; }, [onFalha]);

    // Sem sinal do motoboy o mapa abre no Rio, igual à versão antiga.
    const inicialRef = useRef(motoboyLocation ?? { lat: -22.9068, lng: -43.1729 });

    useEffect(() => aoRecusarChaveDoGoogle(() => onFalhaRef.current()), []);

    useEffect(() => {
        let vivo = true;

        carregarGoogleMaps(googleMapsKey)
            .then((maps) => {
                if (!vivo || !divRef.current) return;

                const mapa = new maps.Map(divRef.current, {
                    center: inicialRef.current,
                    zoom: 15,
                    scrollwheel: false,
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    gestureHandling: "greedy",
                });

                mapaRef.current = mapa;

                if (motoboyLocation) {
                    motoRef.current = new maps.Marker({
                        map: mapa,
                        position: motoboyLocation,
                        title: "Motoboy está aqui!",
                        icon: {
                            url: ICONE_MOTOBOY,
                            scaledSize: new maps.Size(40, 40),
                            anchor: new maps.Point(20, 20),
                        },
                    });
                }

                setPronto(true);
            })
            .catch((erro) => {
                console.warn("[mapa] rastreio caindo pro OpenStreetMap:", erro?.message ?? erro);
                if (vivo) onFalhaRef.current();
            });

        return () => {
            vivo = false;
            motoRef.current?.setMap(null);
            motoRef.current = null;
            mapaRef.current = null;
        };
        // motoboyLocation entra só como posição inicial; o efeito abaixo cuida do resto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [googleMapsKey]);

    // Motoboy andou: pino e câmera acompanham.
    useEffect(() => {
        if (!pronto || !motoboyLocation) return;
        motoRef.current?.setPosition(motoboyLocation);
        mapaRef.current?.setCenter(motoboyLocation);
    }, [pronto, motoboyLocation]);

    return (
        <div className="relative h-[400px] w-full rounded-xl overflow-hidden z-0">
            <div ref={divRef} className="h-full w-full" />
            {!pronto && (
                <div className="absolute inset-0 bg-zinc-100 animate-pulse flex items-center justify-center text-zinc-400">
                    Carregando Mapa...
                </div>
            )}
        </div>
    );
}

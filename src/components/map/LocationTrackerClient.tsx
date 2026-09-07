"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { getDistance } from "geolib";
import { updateLocationAction } from "@/app/actions/tracking";
import { deveEnviarPosicao, type PosicaoEnviada } from "@/lib/gpsThrottle";

/**
 * Manda pro servidor onde o motoboy está, pra loja e o cliente verem no mapa.
 *
 * Duas coisas foram consertadas aqui:
 *  1. Antes cada leitura do GPS (1 por segundo, no Android) virava um POST.
 *     Agora só sai posição depois de 15 segundos E 30 metros andados — e nada
 *     enquanto o celular está no bolso (aba escondida).
 *  2. Erro de GPS só ia pro console e o próprio indicador "GPS Ativo" sumia:
 *     o sinal de problema era a AUSÊNCIA de um selinho que ninguém reparava.
 *     Agora vira um aviso na tela.
 */
export default function LocationTrackerClient() {
    // Só roda no navegador (o pai monta com ssr: false), então dá pra perguntar
    // ao `navigator` já na criação do estado — sem setState dentro do efeito,
    // que causa render em cascata.
    const [suportado] = useState(() => "geolocation" in navigator);
    const [erro, setErro] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const ultimoEnvio = useRef<PosicaoEnviada>(null);
    const ocupado = useRef(false);

    useEffect(() => {
        if (!suportado) return;

        let watcher: number | null = null;

        const aoReceber: PositionCallback = (position) => {
            setErro(false);
            const nova = { lat: position.coords.latitude, lng: position.coords.longitude };

            const vale = deveEnviarPosicao({
                ultimoEnvio: ultimoEnvio.current,
                agora: Date.now(),
                nova,
                // geolib devolve metros inteiros — é o bastante pra decidir 30m.
                distancia: (aLat, aLng, bLat, bLng) =>
                    getDistance({ latitude: aLat, longitude: aLng }, { latitude: bLat, longitude: bLng }),
            });
            if (!vale || ocupado.current) return;

            // Marca ANTES de mandar: se o GPS disparar de novo no meio do envio,
            // não sai um segundo POST pela mesma posição.
            ultimoEnvio.current = { ...nova, quando: Date.now() };
            ocupado.current = true;
            setEnviando(true);
            updateLocationAction(nova.lat, nova.lng)
                .catch((e) => console.warn("[gps] não consegui mandar a posição:", e))
                .finally(() => { ocupado.current = false; setEnviando(false); });
        };

        const aoFalhar: PositionErrorCallback = (e) => {
            console.warn("Erro de geolocalização:", e);
            setErro(true);
        };

        const ligar = () => {
            if (watcher != null) return;
            watcher = navigator.geolocation.watchPosition(aoReceber, aoFalhar, {
                enableHighAccuracy: true,
                timeout: 10000,
                // Aceitar uma leitura de até 10s evita acordar o GPS à toa.
                maximumAge: 10000,
            });
        };

        const desligar = () => {
            if (watcher == null) return;
            navigator.geolocation.clearWatch(watcher);
            watcher = null;
        };

        // Celular no bolso não precisa rastrear: economiza bateria e dado.
        const aoTrocarVisibilidade = () => (document.hidden ? desligar() : ligar());

        if (!document.hidden) ligar();
        document.addEventListener("visibilitychange", aoTrocarVisibilidade);

        return () => {
            desligar();
            document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
        };
    }, [suportado]);

    if (!suportado || erro) {
        return (
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 z-50">
                <div className="bg-amber-500/15 border border-amber-500/50 text-amber-100 text-xs px-3 py-2 rounded-xl shadow-lg flex items-start gap-2">
                    <MapPin size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <span>
                        <strong className="block">Localização desligada</strong>
                        A loja não te vê no mapa. Ligue o GPS e libere a localização pro site.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className={`bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow-lg flex items-center gap-1 ${enviando ? "animate-pulse" : ""}`}>
                <span className="w-2 h-2 bg-white rounded-full"></span>
                GPS Ativo
            </div>
        </div>
    );
}

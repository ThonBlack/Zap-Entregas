"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { PinPickerProps } from "./mapTypes";

const pinIcon = L.icon({
    iconUrl: "/leaflet/marker-icon.png",
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    shadowUrl: "/leaflet/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowSize: [41, 41],
});

const shopIcon = L.divIcon({
    className: "",
    html: `<div style="background:#16a34a;width:14px;height:14px;border-radius:9999px;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

/** Reposiciona a câmera quando o endereço muda por fora (ex.: escolha no autocomplete). */
function Recenter({ position, trigger }: { position: [number, number]; trigger: number }) {
    const map = useMap();
    useEffect(() => {
        if (trigger > 0) map.setView(position, Math.max(map.getZoom(), 16));
    }, [trigger, position, map]);
    return null;
}

/** Tocar no mapa também move o pino — no celular é mais fácil que arrastar. */
function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) { onMove(e.latlng.lat, e.latlng.lng); },
    });
    return null;
}

/** Mapa de reserva: entra quando não há chave do Google ou o script dele falha. */
export default function LeafletPinPicker({ lat, lng, onMove, recenterTrigger = 0, shopLat, shopLng }: PinPickerProps) {
    // Sem "isMounted": quem monta este componente já usa dynamic(ssr: false) com
    // esqueleto de carregamento (PinPicker.tsx), então ele SÓ existe no navegador.
    // O truque antigo obrigava a chamar setState dentro do efeito, o que provoca
    // uma segunda renderização em cascata à toa.
    const markerRef = useRef<L.Marker>(null);

    const position: [number, number] = [lat, lng];

    const dragHandlers = useMemo(() => ({
        dragend() {
            const m = markerRef.current;
            if (!m) return;
            const p = m.getLatLng();
            onMove(p.lat, p.lng);
        },
    }), [onMove]);

    return (
        <MapContainer center={position} zoom={16} scrollWheelZoom={false} className="h-[300px] w-full rounded-xl z-0">
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Recenter position={position} trigger={recenterTrigger} />
            <ClickToMove onMove={onMove} />
            {shopLat != null && shopLng != null && shopLat !== 0 && shopLng !== 0 && (
                <Marker position={[shopLat, shopLng]} icon={shopIcon} interactive={false} />
            )}
            <Marker
                position={position}
                icon={pinIcon}
                draggable
                eventHandlers={dragHandlers}
                ref={markerRef}
            />
        </MapContainer>
    );
}

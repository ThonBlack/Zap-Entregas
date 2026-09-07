"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { TrackingMapProps } from "./mapTypes";

// Fix Leaflet icons
const icon = L.icon({
    iconUrl: "/leaflet/marker-icon.png",
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    shadowUrl: "/leaflet/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const motoboyIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/1986/1986937.png", // Motoboy placeholder icon
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

/** Mapa de reserva do rastreio: entra quando não há chave do Google ou ele falha. */
export default function LeafletTrackingMap({ motoboyLocation }: TrackingMapProps) {
    // Sem "isMounted": TrackingMap.tsx já monta este componente com
    // dynamic(ssr: false) e esqueleto próprio — ele nunca roda no servidor.
    const initialPosition: [number, number] = motoboyLocation
        ? [motoboyLocation.lat, motoboyLocation.lng]
        : [-22.9068, -43.1729]; // Default Rio de Janeiro

    return (
        <MapContainer center={initialPosition} zoom={15} scrollWheelZoom={false} className="h-[400px] w-full rounded-xl z-0">
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {motoboyLocation && (
                <>
                    <Marker position={[motoboyLocation.lat, motoboyLocation.lng]} icon={motoboyIcon}>
                        <Popup>
                            Motoboy está aqui! <br /> Atualizado recentemente.
                        </Popup>
                    </Marker>
                    <MapUpdater center={[motoboyLocation.lat, motoboyLocation.lng]} />
                </>
            )}
        </MapContainer>
    );
}

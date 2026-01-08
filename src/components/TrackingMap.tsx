"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet icons
const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
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

interface TrackingMapProps {
    motoboyLocation?: { lat: number; lng: number } | null;
    deliveryLocation?: { lat: number; lng: number } | null; // We might need to geocode address or just imply
}

export default function TrackingMap({ motoboyLocation }: TrackingMapProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className="h-64 bg-zinc-100 rounded-xl animate-pulse flex items-center justify-center text-zinc-400">Carregando Mapa...</div>;

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

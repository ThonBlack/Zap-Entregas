"use client";

import { useEffect, useState } from "react";
import { updateLocationAction } from "@/app/actions/tracking";

export default function LocationTracker() {
    const [status, setStatus] = useState<"idle" | "tracking" | "error">("idle");

    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setStatus("error");
            return;
        }

        setStatus("tracking");

        const watcher = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Send to server
                await updateLocationAction(latitude, longitude);
            },
            (error) => {
                console.error("Erro de geolocalização:", error);
                setStatus("error");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    if (status === "error") return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                GPS Ativo
            </div>
        </div>
    );
}

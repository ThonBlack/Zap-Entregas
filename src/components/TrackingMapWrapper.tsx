"use client";

import dynamic from "next/dynamic";

const TrackingMapClient = dynamic(
    () => import("@/components/TrackingMap"),
    {
        ssr: false,
        loading: () => <div className="h-[400px] w-full bg-zinc-100 rounded-xl animate-pulse mt-4"></div>
    }
);

interface TrackingMapWrapperProps {
    motoboyLocation: { lat: number; lng: number };
}

export default function TrackingMapWrapper({ motoboyLocation }: TrackingMapWrapperProps) {
    return <TrackingMapClient motoboyLocation={motoboyLocation} />;
}

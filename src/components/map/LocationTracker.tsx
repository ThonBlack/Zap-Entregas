"use client";

import dynamic from "next/dynamic";

/**
 * O rastreador mexe com GPS, `document.hidden` e `navigator` — nada disso existe
 * no servidor. Montando com ssr: false o componente de dentro pode perguntar ao
 * navegador já na primeira renderização, sem o truque do "isMounted" (que
 * obrigava a chamar setState dentro do efeito e gerava render em cascata).
 */
const LocationTrackerClient = dynamic(
    () => import("@/components/map/LocationTrackerClient"),
    { ssr: false }
);

export default function LocationTracker() {
    return <LocationTrackerClient />;
}

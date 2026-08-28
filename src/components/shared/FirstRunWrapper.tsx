"use client";

import dynamic from "next/dynamic";

/**
 * Os convites do primeiro acesso mexem com APIs que só existem no navegador
 * (Notification, service worker, localStorage), então nada disso é montado no
 * servidor.
 */
const FirstRunPrompts = dynamic(
    () => import("@/components/shared/FirstRunPrompts"),
    { ssr: false }
);

interface FirstRunWrapperProps {
    userId: number;
    semDigital: boolean;
}

export default function FirstRunWrapper({ userId, semDigital }: FirstRunWrapperProps) {
    return <FirstRunPrompts userId={userId} semDigital={semDigital} />;
}

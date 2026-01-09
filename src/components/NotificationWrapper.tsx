"use client";

import dynamic from "next/dynamic";

const NotificationManager = dynamic(
    () => import("@/components/NotificationManager"),
    { ssr: false }
);

interface NotificationWrapperProps {
    userId: number;
    userRole: "motoboy" | "shopkeeper" | "admin";
}

export default function NotificationWrapper({ userId, userRole }: NotificationWrapperProps) {
    return <NotificationManager userId={userId} userRole={userRole} />;
}

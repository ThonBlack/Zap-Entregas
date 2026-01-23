"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, BellRing } from "lucide-react";

interface NotificationManagerProps {
    userId: number;
    userRole: "motoboy" | "shopkeeper" | "admin";
}

export default function NotificationManager({ userId, userRole }: NotificationManagerProps) {
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isEnabled, setIsEnabled] = useState(false);
    const lastCheckRef = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Check notification permission
        if ("Notification" in window) {
            setPermission(Notification.permission);
            setIsEnabled(Notification.permission === "granted");
        }

        // Create audio element for notification sound
        audioRef.current = new Audio("/notification.mp3");
        audioRef.current.volume = 0.5;
    }, []);

    useEffect(() => {
        if (!isEnabled) return;

        const checkForUpdates = async () => {
            try {
                const response = await fetch(`/api/notifications/check?userId=${userId}&lastCheck=${lastCheckRef.current}`);
                const data = await response.json();

                if (data.notifications && data.notifications.length > 0) {
                    for (const notif of data.notifications) {
                        showNotification(notif.title, notif.body, notif.icon);
                    }
                }

                lastCheckRef.current = Date.now();
            } catch (error) {
                console.error("Error checking notifications:", error);
            }
        };

        // Poll every 10 seconds
        const interval = setInterval(checkForUpdates, 10000);

        return () => clearInterval(interval);
    }, [isEnabled, userId]);

    const requestPermission = async () => {
        if ("Notification" in window) {
            const perm = await Notification.requestPermission();
            setPermission(perm);
            setIsEnabled(perm === "granted");
        }
    };

    const showNotification = (title: string, body: string, icon?: string) => {
        if (permission !== "granted") return;

        // Play sound
        if (audioRef.current) {
            audioRef.current.play().catch(() => { });
        }

        // Vibrate if supported
        if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        // Show notification
        const notification = new Notification(title, {
            body,
            icon: icon || "/icon-512.png",
            badge: "/icon-512.png",
            tag: `zap-${Date.now()}`,
            requireInteraction: true,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    };

    if (permission === "granted") {
        return null; // Already enabled, no UI needed
    }

    return (
        <div className="fixed bottom-20 right-4 z-40">
            <button
                onClick={requestPermission}
                className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-500 transition-all animate-bounce"
                title="Ativar Notificações"
            >
                {permission === "default" ? <Bell size={24} /> : <BellRing size={24} />}
            </button>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Download className="text-green-600" size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-zinc-900">Instalar App</h4>
                        <p className="text-xs text-zinc-500">Adicione à tela inicial para melhor experiência</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsVisible(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                        <X size={20} />
                    </button>
                    <button onClick={handleInstall} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700">
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    );
}

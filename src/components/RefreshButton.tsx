"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleRefresh = () => {
        setIsLoading(true);
        router.refresh();
        setTimeout(() => setIsLoading(false), 1000); // Visual feedback duration
    };

    return (
        <button
            onClick={handleRefresh}
            className="p-2 text-zinc-600 bg-white border border-zinc-200 hover:border-blue-300 hover:text-blue-600 rounded-lg shadow-sm transition-all active:scale-95"
            title="Atualizar lista"
        >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </button>
    );
}

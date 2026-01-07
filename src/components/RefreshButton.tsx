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
            className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 rounded-full transition-all active:scale-95"
            title="Atualizar lista"
        >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
        </button>
    );
}

"use client";

import { useActionState, useState } from "react";
import { UserPlus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { adminCreateUserAction } from "@/app/actions/admin-users";

const initialState: { error?: string } = {};

function genPassword(len = 12) {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
}

export default function AdminCreateUserForm() {
    const [state, formAction, isPending] = useActionState(
        adminCreateUserAction as any,
        initialState
    );
    const [role, setRole] = useState<"shopkeeper" | "motoboy" | "admin">("shopkeeper");
    const [password, setPassword] = useState(genPassword(12));

    const inputClass =
        "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-600 outline-none";

    return (
        <form action={formAction} className="space-y-5">
            {state?.error && (
                <div className="p-3 rounded-lg bg-red-600/20 text-red-300 border border-red-600/40 flex items-center gap-2 text-sm">
                    <AlertCircle size={16} /> {state.error}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 block">
                        Nome / Razão Social *
                    </label>
                    <input
                        name="name"
                        type="text"
                        required
                        placeholder="Vapor Fume"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 block">
                        Telefone *
                    </label>
                    <input
                        name="phone"
                        type="tel"
                        required
                        placeholder="34999999999"
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 block">
                    Email (opcional)
                </label>
                <input
                    name="email"
                    type="email"
                    placeholder="contato@vaporfume.com.br"
                    className={inputClass}
                />
            </div>

            <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-2 block">
                    Papel *
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {(["shopkeeper", "motoboy", "admin"] as const).map((r) => (
                        <button
                            type="button"
                            key={r}
                            onClick={() => setRole(r)}
                            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                                role === r
                                    ? "border-green-500 bg-green-900/30 text-green-300"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                            }`}
                        >
                            {r === "shopkeeper" ? "🏪 Lojista" : r === "motoboy" ? "🏍️ Motoboy" : "👑 Admin"}
                        </button>
                    ))}
                </div>
                <input type="hidden" name="role" value={role} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 block">
                        Plano *
                    </label>
                    <select
                        name="plan"
                        defaultValue={role === "shopkeeper" ? "free" : "free"}
                        className={inputClass}
                    >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="growth">Growth</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1 block">
                        Senha temporária *
                    </label>
                    <div className="flex gap-2">
                        <input
                            name="password"
                            type="text"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`${inputClass} font-mono`}
                        />
                        <button
                            type="button"
                            onClick={() => setPassword(genPassword(12))}
                            className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                            title="Gerar nova senha"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                        Anote — o usuário trocará no primeiro login.
                    </p>
                </div>
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
            >
                {isPending ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {isPending ? "Criando..." : "Criar Usuário"}
            </button>
        </form>
    );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Package, Smartphone, ShoppingCart, Globe, Monitor, Loader2 } from "lucide-react";

const productTypes = [
    { value: "saas", label: "SaaS Web", icon: Globe, description: "Aplicações web com assinaturas" },
    { value: "playstore", label: "Play Store", icon: Smartphone, description: "Apps publicados na Google Play" },
    { value: "ecommerce", label: "E-commerce", icon: ShoppingCart, description: "Lojas online" },
    { value: "standalone", label: "App Avulso", icon: Package, description: "Apps distribuídos fora de lojas" },
    { value: "desktop", label: "Desktop", icon: Monitor, description: "Softwares para PC/Mac" },
];

export default function NewProductPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: "",
        type: "saas",
        description: "",
        packageName: "",
        webhookUrl: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/master/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-ADMIN-KEY": "admin_master_secret_key", // Em produção, pegar de env/session
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(data.product);
            } else {
                setError(data.error || "Erro ao criar produto");
            }
        } catch (err) {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-zinc-900 pb-20">
                <header className="bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-700 px-6 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-4">
                        <Link href="/admin/master" className="p-2 text-purple-300 hover:text-white rounded-lg hover:bg-purple-800/50 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-bold text-white">Produto Criado!</h1>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto p-6">
                    <Card className="p-6 bg-zinc-800 border-zinc-700">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="text-green-400" size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">{success.name}</h2>
                            <p className="text-zinc-500">Produto registrado com sucesso!</p>
                        </div>

                        <div className="bg-zinc-900 rounded-xl p-4 mb-6">
                            <p className="text-xs text-zinc-500 mb-2">Sua API Key (guarde em local seguro):</p>
                            <code className="text-green-400 text-sm break-all">{success.apiKey}</code>
                        </div>

                        <div className="bg-amber-600/20 border border-amber-600/40 rounded-xl p-4 mb-6">
                            <p className="text-amber-300 text-sm">
                                ⚠️ Esta chave só será exibida uma vez. Copie e guarde agora!
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => navigator.clipboard.writeText(success.apiKey)}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-colors"
                            >
                                Copiar API Key
                            </button>
                            <Link
                                href="/admin/master"
                                className="flex-1 py-3 bg-zinc-700 text-white rounded-xl font-bold hover:bg-zinc-600 transition-colors text-center"
                            >
                                Voltar
                            </Link>
                        </div>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-700 px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <Link href="/admin/master" className="p-2 text-purple-300 hover:text-white rounded-lg hover:bg-purple-800/50 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Novo Produto</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6">
                <form onSubmit={handleSubmit}>
                    <Card className="p-6 bg-zinc-800 border-zinc-700 space-y-6">
                        {/* Nome */}
                        <div>
                            <label className="block text-white text-sm font-medium mb-2">
                                Nome do Produto *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Meu App, Minha Loja..."
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                required
                            />
                        </div>

                        {/* Tipo */}
                        <div>
                            <label className="block text-white text-sm font-medium mb-2">
                                Tipo de Produto *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {productTypes.map((type) => {
                                    const Icon = type.icon;
                                    const isSelected = formData.type === type.value;
                                    return (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: type.value })}
                                            className={`p-4 rounded-xl border-2 text-left transition-colors ${isSelected
                                                    ? 'bg-purple-600/20 border-purple-500'
                                                    : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <Icon className={isSelected ? 'text-purple-400' : 'text-zinc-500'} size={24} />
                                            <p className={`font-medium mt-2 ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                                                {type.label}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">{type.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Descrição */}
                        <div>
                            <label className="block text-white text-sm font-medium mb-2">
                                Descrição (opcional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Breve descrição do produto..."
                                rows={3}
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
                            />
                        </div>

                        {/* Package Name (para apps) */}
                        {(formData.type === "playstore" || formData.type === "standalone") && (
                            <div>
                                <label className="block text-white text-sm font-medium mb-2">
                                    Package Name (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.packageName}
                                    onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                                    placeholder="com.exemplo.meuapp"
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        )}

                        {/* Webhook URL */}
                        <div>
                            <label className="block text-white text-sm font-medium mb-2">
                                Webhook URL (opcional)
                            </label>
                            <input
                                type="url"
                                value={formData.webhookUrl}
                                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                                placeholder="https://meusite.com/webhook"
                                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                Receba notificações quando eventos forem registrados neste produto.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-600/20 border border-red-600/40 rounded-xl p-4">
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !formData.name}
                            className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Package size={20} />
                                    Criar Produto
                                </>
                            )}
                        </button>
                    </Card>
                </form>
            </main>
        </div>
    );
}

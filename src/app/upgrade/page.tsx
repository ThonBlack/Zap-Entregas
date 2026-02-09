import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Crown, Rocket, Shield, Clock, Users, Star, TrendingUp, MessageCircle, ChevronRight, PartyPopper, Package, MapPin } from "lucide-react";

export default async function UpgradePage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const allPlans = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.price);

    const planIcons: Record<string, any> = {
        "Grátis (Motoboy)": Zap,
        "Motoboy Pro": Sparkles,
        "Starter (Lojista)": Rocket,
        "Growth (Lojista)": Crown,
        "Unlimited": Crown,
    };

    const testimonials = [
        { name: "João Silva", role: "Dono de Pizzaria", text: "Reduzi em 40% o tempo de organização das entregas!", avatar: "🍕" },
        { name: "Maria Santos", role: "Motoboy Autônoma", text: "Nunca mais perdi uma corrida. O app me deixa organizada!", avatar: "🏍️" },
        { name: "Carlos Lima", role: "Disque Bebidas", text: "Meus clientes amam acompanhar o pedido em tempo real.", avatar: "🍺" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white overflow-hidden">
            {/* Hero Section */}
            <section className="relative py-16 md:py-24 px-4">
                {/* Background Decorations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-10 left-10 text-6xl animate-bounce opacity-80" style={{ animationDelay: "0s" }}>🎉</div>
                    <div className="absolute top-20 right-20 text-5xl animate-bounce opacity-80" style={{ animationDelay: "0.2s" }}>🎊</div>
                    <div className="absolute bottom-20 left-1/4 text-4xl animate-bounce opacity-80" style={{ animationDelay: "0.4s" }}>🎈</div>
                    <div className="absolute bottom-10 right-1/3 text-5xl animate-bounce opacity-80" style={{ animationDelay: "0.6s" }}>🏍️</div>
                    <div className="absolute top-1/3 right-10 w-32 h-32 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full blur-3xl opacity-20"></div>
                    <div className="absolute bottom-1/4 left-10 w-40 h-40 bg-gradient-to-br from-green-400 to-teal-500 rounded-full blur-3xl opacity-15"></div>
                </div>

                <div className="max-w-5xl mx-auto relative z-10 text-center">
                    {/* Promo Badge */}
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2 rounded-full text-sm font-bold mb-6 shadow-lg animate-pulse">
                        <PartyPopper size={18} />
                        <span>🎁 OFERTA ESPECIAL: 30 dias grátis para novos usuários!</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                        Suas entregas vão
                        <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent"> bombar </span>
                        🚀
                    </h1>

                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
                        Mais de <strong className="text-green-400">2.500+ empresas</strong> já usam o Zap Entregas para
                        organizar motoboys e deixar clientes felizes. E você?
                    </p>

                    {/* Social Proof */}
                    <div className="flex items-center justify-center gap-6 mb-12">
                        <div className="flex -space-x-3">
                            {["🧑", "👨", "👩", "🧔", "👱"].map((emoji, i) => (
                                <div key={i} className="w-12 h-12 rounded-full bg-zinc-700 border-3 border-zinc-600 shadow-md flex items-center justify-center text-xl">
                                    {emoji}
                                </div>
                            ))}
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-1 text-yellow-400">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={18} fill="currentColor" />)}
                            </div>
                            <p className="text-sm text-zinc-500 font-medium">4.9/5 de 847 avaliações</p>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:scale-105 transition-all shadow-lg">
                            Começar Grátis Agora 🎉
                        </Link>
                        <a href="https://wa.me/5521979584070?text=Olá! Quero saber mais sobre o Zap Entregas" className="bg-zinc-800 border-2 border-green-500 text-green-400 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                            <MessageCircle size={20} />
                            Falar com a Gente
                        </a>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-16 px-4 bg-zinc-800/50 backdrop-blur">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                        Por que o <span className="text-green-400">Zap Entregas</span> é diferente? 💡
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-zinc-800 border border-zinc-700 rounded-3xl p-8 text-center hover:scale-105 transition-transform hover:border-green-500/50">
                            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <TrendingUp className="text-white" size={32} />
                            </div>
                            <h3 className="font-bold text-xl mb-2 text-green-400">Mais Lucro 💰</h3>
                            <p className="text-zinc-400">Rotas otimizadas = menos combustível = mais dinheiro pra você!</p>
                        </div>
                        <div className="bg-zinc-800 border border-zinc-700 rounded-3xl p-8 text-center hover:scale-105 transition-transform hover:border-green-500/50">
                            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Users className="text-white" size={32} />
                            </div>
                            <h3 className="font-bold text-xl mb-2 text-green-400">Clientes Felizes 😄</h3>
                            <p className="text-zinc-400">Organize suas entregas e entregue mais rápido!</p>
                        </div>
                        <div className="bg-zinc-800 border border-zinc-700 rounded-3xl p-8 text-center hover:scale-105 transition-transform hover:border-green-500/50">
                            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Shield className="text-white" size={32} />
                            </div>
                            <h3 className="font-bold text-xl mb-2 text-green-400">Controle Total 🎯</h3>
                            <p className="text-zinc-400">Gerencie sua equipe e acompanhe cada entrega em um só lugar!</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="py-16 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 mb-4 px-4 py-1 text-sm font-bold">
                            💡 Planos simples, sem pegadinhas
                        </Badge>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Escolha seu plano e <span className="text-green-400">decole!</span> 🚀
                        </h2>
                        <p className="text-zinc-500">Cancele quando quiser. Sem multa. Sem frescura.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {allPlans.map(plan => {
                            const Icon = planIcons[plan.name] || Sparkles;
                            const isFree = plan.price === 0;
                            const isPopular = plan.name.includes("Starter");
                            const isUnlimited = plan.name.includes("Unlimited") || plan.price === 149.9;

                            let cardBg = "bg-zinc-800 border-zinc-700";
                            if (isPopular) cardBg = "bg-gradient-to-br from-green-900/50 to-emerald-900/30 border-green-500";
                            if (isUnlimited) cardBg = "bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-zinc-800 border-amber-500";

                            return (
                                <Card
                                    key={plan.id}
                                    className={`relative p-8 border-2 rounded-3xl ${cardBg} ${isPopular ? 'ring-4 ring-green-500/30 scale-105 z-10' : ''} ${isUnlimited ? 'ring-4 ring-amber-500/30' : ''}`}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 font-bold shadow-lg text-sm">
                                                ⭐ O Mais Escolhido!
                                            </Badge>
                                        </div>
                                    )}
                                    {isUnlimited && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1.5 font-bold shadow-lg text-sm">
                                                👑 Para Feras!
                                            </Badge>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 mb-6 mt-2">
                                        <div className="w-14 h-14 rounded-2xl bg-zinc-700 shadow-md flex items-center justify-center">
                                            <Icon className="text-green-400" size={28} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                                            <span className="text-zinc-500 text-sm">{isFree ? "Com anúncios" : "Sem anúncios ✨"}</span>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        {isFree ? (
                                            <p className="text-4xl font-extrabold text-white">Grátis</p>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-zinc-500 line-through">R$ {(plan.price! * 1.3).toFixed(2).replace('.', ',')}</p>
                                                <p className="text-4xl font-extrabold text-white">
                                                    R$ {plan.price?.toFixed(2).replace('.', ',')}
                                                    <span className="text-base font-normal text-zinc-500">/mês</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-3 mb-8">
                                        <li className="flex items-center gap-3 text-zinc-300">
                                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                                <Check size={14} className="text-white" />
                                            </div>
                                            {plan.maxMotoboys === 999 ? "Motoboys ilimitados" : `Até ${plan.maxMotoboys} motoboy(s)`}
                                        </li>
                                        <li className="flex items-center gap-3 text-zinc-300">
                                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                                <Check size={14} className="text-white" />
                                            </div>
                                            {plan.maxDeliveries === 99999 ? "Entregas ilimitadas 🔥" : `${plan.maxDeliveries} entregas/mês`}
                                        </li>
                                        <li className="flex items-center gap-3 text-zinc-300">
                                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                                <Check size={14} className="text-white" />
                                            </div>
                                            Dashboard completo
                                        </li>
                                        {!isFree && (
                                            <li className="flex items-center gap-3 text-green-400 font-medium">
                                                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                                    <MapPin size={14} className="text-white" />
                                                </div>
                                                Rastreamento GPS em tempo real 📍
                                            </li>
                                        )}
                                        {isUnlimited && (
                                            <li className="flex items-center gap-3 text-amber-400 font-medium">
                                                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                                    <MessageCircle size={14} className="text-white" />
                                                </div>
                                                Suporte VIP via WhatsApp 💬
                                            </li>
                                        )}
                                    </ul>

                                    {isFree ? (
                                        <div className="w-full py-4 rounded-2xl font-bold text-base text-center bg-zinc-700 text-zinc-500 cursor-default">
                                            Plano Atual
                                        </div>
                                    ) : (
                                        <a
                                            href={`https://wa.me/5521979584070?text=Olá! Quero assinar o plano ${plan.name} do Zap Entregas!`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`w-full py-4 rounded-2xl font-bold text-base transition-all block text-center ${isPopular
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl shadow-lg'
                                                : 'bg-zinc-700 text-white hover:bg-zinc-600'
                                                } active:scale-[0.98]`}
                                        >
                                            Quero Esse! 🎉
                                        </a>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-16 px-4 bg-zinc-800/50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                        Quem usa, ama! 💖
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.map((t, i) => (
                            <div key={i} className="bg-zinc-800 rounded-3xl p-6 shadow-md border border-zinc-700">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center text-2xl shadow-sm">
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{t.name}</p>
                                        <p className="text-sm text-zinc-500">{t.role}</p>
                                    </div>
                                </div>
                                <p className="text-zinc-400 italic">&quot;{t.text}&quot;</p>
                                <div className="flex items-center gap-1 mt-4 text-yellow-400">
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="currentColor" />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 px-4 bg-zinc-900">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                        Dúvidas? A gente responde! 🙋
                    </h2>
                    <div className="space-y-4">
                        {[
                            { q: "Posso cancelar quando quiser?", a: "Claro! Sem multas, sem burocracia. É só cancelar pelo app a hora que quiser." },
                            { q: "Funciona no meu celular?", a: "Sim! Funciona em qualquer celular Android ou iPhone, direto pelo navegador. É só acessar!" },
                            { q: "Preciso de cartão de crédito?", a: "Só para planos pagos. O plano grátis é 100% free, sem enrolação!" },
                            { q: "Como faço para falar com vocês?", a: "É só chamar no WhatsApp! Respondemos rapidinho 💬" },
                        ].map((faq, i) => (
                            <details key={i} className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 group">
                                <summary className="font-bold cursor-pointer flex items-center justify-between text-white">
                                    {faq.q}
                                    <ChevronRight className="group-open:rotate-90 transition-transform text-zinc-500" size={20} />
                                </summary>
                                <p className="mt-3 text-zinc-400">{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-16 px-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="text-5xl mb-4">🎉🏍️🎊</div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Bora organizar suas entregas?
                    </h2>
                    <p className="text-green-100 text-lg mb-8">
                        Comece agora, é grátis! Sem precisar de cartão.
                    </p>
                    <Link href="/" className="inline-block bg-white text-green-700 px-10 py-5 rounded-2xl font-bold text-xl hover:bg-green-50 active:scale-[0.98] transition-all shadow-2xl">
                        Começar Grátis Agora 🚀
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-4 text-center text-zinc-500 text-sm bg-zinc-900 border-t border-zinc-800">
                <p>© 2026 Zap Entregas. Feito com 💚 no Brasil.</p>
                <Link href="/" className="text-green-400 hover:text-green-300 mt-2 inline-block font-medium">
                    ← Voltar para o Dashboard
                </Link>
            </footer>
        </div>
    );
}

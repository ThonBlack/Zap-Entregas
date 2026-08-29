import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { APK_URL, firstName, isInviteExpired } from "@/lib/invite";
import AcceptInviteForm from "@/components/auth/AcceptInviteForm";

export const dynamic = "force-dynamic";

/**
 * Convite do motoboy — página PÚBLICA.
 *
 * Quem abre não tem login: o que autoriza é o código da URL, que vale pra uma
 * conta só, vence em 7 dias e é apagado no uso. Por isso a tela mostra o mínimo
 * possível (só o primeiro nome) — um link vazado não pode virar consulta de cadastro.
 */
export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const convidado = token && token.length >= 16
        ? await db.query.users.findFirst({
            where: eq(users.inviteToken, token),
            columns: { name: true, role: true, isActive: true, inviteTokenExpiresAt: true },
        })
        : null;

    const expirado = Boolean(convidado && isInviteExpired(convidado.inviteTokenExpiresAt));
    const valido = !!convidado && convidado.role === "motoboy" && convidado.isActive !== false && !expirado;

    return (
        <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center px-6 py-10">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-3 bg-green-600 rounded-2xl p-2 shadow-lg">
                        <Image
                            src="/logo.png"
                            alt="Zap Entregas"
                            width={80}
                            height={80}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold">Zap Entregas</h1>
                </div>

                {valido ? (
                    <AcceptInviteForm
                        token={token}
                        primeiroNome={firstName(convidado!.name)}
                        apkUrl={APK_URL}
                    />
                ) : (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 space-y-3 text-center">
                        <h2 className="text-xl font-bold">
                            {expirado ? "Convite expirado" : "Convite inválido"}
                        </h2>
                        <p className="text-sm text-zinc-400">
                            {expirado
                                ? "Esse link passou dos 7 dias e não vale mais."
                                : "Esse link não existe mais — ou já foi usado pra criar a senha."}
                        </p>
                        <p className="text-sm text-zinc-300">
                            Peça um novo convite pra loja que te cadastrou.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block text-sm text-green-400 hover:text-green-300 pt-2"
                        >
                            Já tenho senha — ir pro login
                        </Link>
                    </div>
                )}

                <p className="text-center text-xs text-zinc-600">
                    © 2026 Zap Entregas • Feito com 💚 no Brasil
                </p>
            </div>
        </div>
    );
}

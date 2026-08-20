"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { getAuthUser, setSessionCookie, setTwoFactorPendingCookie } from "@/lib/session";
import {
    RP_NAME, rpID, expectedOrigin, saveChallenge, takeChallenge, guessDeviceName,
} from "@/lib/webauthn";

type Erro = { error: string };

const b64 = {
    toBuffer: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
    fromBuffer: (b: Uint8Array) => Buffer.from(b).toString("base64url"),
};

// ---------------------------------------------------------------- cadastro

/** Passo 1 do cadastro: pede ao navegador para criar uma digital pra este usuário. */
export async function startPasskeyRegistration(): Promise<PublicKeyCredentialCreationOptionsJSON | Erro> {
    const auth = await getAuthUser();
    if ("error" in auth) return { error: auth.error };

    const jaCadastradas = await db.select().from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, auth.user.id));

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: rpID(),
        userID: new TextEncoder().encode(String(auth.user.id)),
        userName: auth.user.phone,
        userDisplayName: auth.user.name,
        attestationType: "none",
        // Não deixa cadastrar o mesmo aparelho duas vezes.
        excludeCredentials: jaCadastradas.map(c => ({
            id: c.credentialId,
            transports: c.transports ? c.transports.split(",") as never : undefined,
        })),
        authenticatorSelection: {
            // "preferred": o aparelho guarda a passkey e consegue entrar sem digitar nada.
            residentKey: "preferred",
            userVerification: "preferred",
        },
    });

    await saveChallenge(options.challenge);
    return options;
}

/** Passo 2 do cadastro: confere a resposta do aparelho e guarda a chave pública. */
export async function finishPasskeyRegistration(
    response: RegistrationResponseJSON
): Promise<{ success: true } | Erro> {
    const auth = await getAuthUser();
    if ("error" in auth) return { error: auth.error };

    const challenge = await takeChallenge();
    if (!challenge) return { error: "O cadastro demorou demais. Tente de novo." };

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: challenge,
            expectedOrigin: expectedOrigin(),
            expectedRPID: rpID(),
            requireUserVerification: false,
        });
    } catch (e: unknown) {
        console.error("[PASSKEY] cadastro falhou:", e);
        return { error: "Não consegui cadastrar essa digital neste aparelho." };
    }

    if (!verification.verified) return { error: "Não consegui confirmar a digital." };

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const userAgent = (await headers()).get("user-agent");

    try {
        await db.insert(webauthnCredentials).values({
            userId: auth.user.id,
            credentialId: credential.id,
            publicKey: b64.fromBuffer(credential.publicKey),
            counter: credential.counter,
            transports: credential.transports?.join(",") ?? null,
            deviceName: guessDeviceName(userAgent),
        });
    } catch {
        return { error: "Essa digital já está cadastrada." };
    }

    console.log("[PASSKEY] cadastrada:", { userId: auth.user.id, credentialDeviceType, credentialBackedUp });

    revalidatePath("/settings");
    revalidatePath("/settings/motoboy");
    return { success: true };
}

// ------------------------------------------------------------------ login

/** Passo 1 do login: o aparelho escolhe qual digital usar (não precisa digitar telefone). */
export async function startPasskeyLogin(): Promise<PublicKeyCredentialRequestOptionsJSON | Erro> {
    const options = await generateAuthenticationOptions({
        rpID: rpID(),
        userVerification: "preferred",
        // Sem lista: o próprio aparelho mostra as digitais que ele guarda deste site.
        allowCredentials: [],
    });

    await saveChallenge(options.challenge);
    return options;
}

/** Passo 2 do login: confere a assinatura e abre a sessão. */
export async function finishPasskeyLogin(
    response: AuthenticationResponseJSON
): Promise<{ success: true; twoFactor?: boolean } | Erro> {
    const challenge = await takeChallenge();
    if (!challenge) return { error: "A tentativa demorou demais. Tente de novo." };

    const stored = await db.query.webauthnCredentials.findFirst({
        where: eq(webauthnCredentials.credentialId, response.id),
    });
    if (!stored) return { error: "Essa digital não está cadastrada aqui." };

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge,
            expectedOrigin: expectedOrigin(),
            expectedRPID: rpID(),
            credential: {
                id: stored.credentialId,
                publicKey: b64.toBuffer(stored.publicKey),
                counter: stored.counter,
                transports: stored.transports ? stored.transports.split(",") as never : undefined,
            },
            requireUserVerification: false,
        });
    } catch (e: unknown) {
        console.error("[PASSKEY] login falhou:", e);
        return { error: "Não consegui confirmar a digital." };
    }

    if (!verification.verified) return { error: "Não consegui confirmar a digital." };

    const user = await db.query.users.findFirst({ where: eq(users.id, stored.userId) });
    if (!user) return { error: "Usuário não encontrado." };
    if (user.isActive === false) return { error: "Conta desativada. Fale com o administrador." };

    // Contador sempre pra frente: se voltar, o autenticador pode ter sido clonado.
    await db.update(webauthnCredentials)
        .set({
            counter: verification.authenticationInfo.newCounter,
            lastUsedAt: new Date().toISOString(),
        })
        .where(eq(webauthnCredentials.id, stored.id));

    if (user.twoFactorEnabled && user.twoFactorSecret) {
        await setTwoFactorPendingCookie(user.id);
        return { success: true, twoFactor: true };
    }

    await setSessionCookie(user.id);
    return { success: true };
}

// ----------------------------------------------------------------- gestão

export async function deletePasskeyAction(id: number): Promise<{ success: true } | Erro> {
    const auth = await getAuthUser();
    if ("error" in auth) return { error: auth.error };
    if (!Number.isInteger(id) || id <= 0) return { error: "Registro inválido." };

    const apagadas = await db.delete(webauthnCredentials)
        .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, auth.user.id)))
        .returning();

    if (!apagadas.length) return { error: "Digital não encontrada." };

    revalidatePath("/settings");
    revalidatePath("/settings/motoboy");
    return { success: true };
}

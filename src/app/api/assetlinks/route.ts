import { NextResponse } from "next/server";

/**
 * Digital Asset Links: prova pro Android que o app da Play Store e este site
 * são do mesmo dono. Sem isso o app abre com a barra de endereço do Chrome.
 *
 * As impressões digitais (SHA-256 do certificado) ficam em env porque mudam:
 * a do certificado local (a que assinamos aqui) e a que o Google gera quando
 * o app entra no Play App Signing. Assim dá pra ajustar sem refazer a imagem.
 *
 * Formato: ANDROID_CERT_FINGERPRINTS="AA:BB:...,CC:DD:..."
 */
export async function GET() {
    const pacote = process.env.ANDROID_PACKAGE_NAME || "shop.vaporfume.zapentregas";
    const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS || "")
        .split(",")
        .map(f => f.trim().toUpperCase())
        .filter(Boolean);

    const body = fingerprints.length
        ? [{
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
                namespace: "android_app",
                package_name: pacote,
                sha256_cert_fingerprints: fingerprints,
            },
        }]
        : [];

    return NextResponse.json(body, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
        },
    });
}

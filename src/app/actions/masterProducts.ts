"use server";

import { db } from "@/db";
import { masterProducts } from "@/db/schema";
import { randomBytes } from "crypto";
import { getAuthUserWithRole } from "@/lib/session";
import { logServerError } from "@/lib/serverLog";

const TIPOS = ["saas", "playstore", "ecommerce", "standalone", "desktop"] as const;
type Tipo = (typeof TIPOS)[number];

/** Campo de texto do formulário, aparado e com tamanho de teto. */
function texto(v: FormDataEntryValue | null, max: number): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
}

/**
 * Cadastrar um produto no painel master.
 *
 * Antes a tela fazia `fetch("/api/master/products")` de dentro do navegador com
 * a chave de admin ESCRITA NO CÓDIGO ("admin_master_secret_key"), ou seja,
 * entregue a qualquer visitante junto com o pacote JavaScript. Agora quem
 * autoriza é a sessão: a chave nunca sai do servidor.
 *
 * A rota HTTP com `X-ADMIN-KEY` continua existindo — ela é pra máquina (outro
 * produto da Epic Corp chamando de fora), não pra tela.
 */
export type ProdutoMasterCriado = { id: number; name: string; type: string; apiKey: string };

type ResultadoDoCadastro =
    | { error: string; product?: undefined }
    | { error?: undefined; product: ProdutoMasterCriado };

export async function criarProdutoMasterAction(formData: FormData): Promise<ResultadoDoCadastro> {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return { error: "Acesso negado." };

    // O painel master só funciona com a chave configurada no servidor. Sem ela,
    // a rota HTTP recusa tudo — a tela avisa em vez de cadastrar pela metade.
    const chave = process.env.MASTER_ADMIN_KEY || "";
    if (chave.length < 16) {
        return { error: "Painel master não configurado no servidor (MASTER_ADMIN_KEY). Fale com o suporte." };
    }

    const name = texto(formData.get("name"), 120);
    const tipoDigitado = texto(formData.get("type"), 40);

    if (!name) return { error: "Informe o nome do produto." };
    if (!tipoDigitado || !TIPOS.includes(tipoDigitado as Tipo)) {
        return { error: "Escolha um tipo de produto válido." };
    }
    const type = tipoDigitado as Tipo;

    const apiKey = `master_${type}_${Date.now()}_${randomBytes(24).toString("hex")}`;

    try {
        const novo = await db.insert(masterProducts).values({
            name,
            type,
            description: texto(formData.get("description"), 500),
            packageName: texto(formData.get("packageName"), 120),
            webhookUrl: texto(formData.get("webhookUrl"), 300),
            apiKey,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }).returning().get();

        return { product: { id: novo.id, name: novo.name, type: novo.type, apiKey: novo.apiKey } };
    } catch (e) {
        console.error("[MASTER] falha ao cadastrar produto:", e);
        await logServerError("criar_produto_master", e, { userId: auth.user.id, name, type });
        return { error: "Não foi possível cadastrar o produto. Tente de novo." };
    }
}

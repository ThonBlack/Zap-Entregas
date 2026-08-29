import { requireShopkeeper } from "@/lib/session";

/**
 * Guarda da tela "Nova Rota de Entrega".
 *
 * A página em si é um componente de cliente ("use client") e não conseguia
 * conferir login nenhum: qualquer um com o endereço /routes/new abria o
 * formulário de cadastrar corrida — motoboy inclusive, e conta desativada
 * também. O layout roda no servidor, antes da página, e é onde a tranca cabe.
 */
export default async function RoutesNewLayout({ children }: { children: React.ReactNode }) {
    await requireShopkeeper();
    return <>{children}</>;
}

/**
 * Esqueleto cinza que aparece enquanto o servidor monta a página.
 *
 * Sem isso, no App Router a tela ANTERIOR fica congelada até a resposta chegar:
 * no 4G do motoboy o toque parece que não funcionou e ele toca de novo.
 */
export default function PageSkeleton({ linhas = 4 }: { linhas?: number }) {
    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8" aria-busy="true" aria-live="polite">
            <div className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-zinc-700 animate-pulse" />
                <div className="space-y-2">
                    <div className="h-5 w-44 rounded bg-zinc-700 animate-pulse" />
                    <div className="h-3 w-28 rounded bg-zinc-700/70 animate-pulse" />
                </div>
            </div>
            <div className="max-w-4xl mx-auto p-6 space-y-4">
                <span className="sr-only">Carregando…</span>
                {Array.from({ length: linhas }).map((_, i) => (
                    <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-3">
                        <div className="h-4 w-1/3 rounded bg-zinc-700 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-zinc-700/70 animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-zinc-700/70 animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}

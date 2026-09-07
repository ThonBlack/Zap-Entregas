"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    /**
     * Pode ser assíncrona: o modal espera terminar, mostra "aguarde…" e só fecha
     * no sucesso. Erro = jogue uma exceção (throw) com a frase que o usuário lê.
     */
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    requireConfirmationWord?: string; // Se setado, o usuário precisa digitar essa palavra pra confirmar
    /** Texto do botão enquanto a ação roda. */
    pendingText?: string;
}

/**
 * Deixa a comparação tolerante: ignora maiúscula/minúscula, espaços das pontas e
 * acentos. Assim "excluir", "Excluir" e "EXCLUIR " valem a mesma coisa.
 */
function normalizeWord(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // tira acentos
        .trim()
        .toUpperCase();
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "info",
    requireConfirmationWord,
    pendingText = "Aguarde…",
}: ConfirmationModalProps) {
    const [confirmationInput, setConfirmationInput] = useState("");
    const [executando, setExecutando] = useState(false);
    const [erro, setErro] = useState("");

    // O componente fica montado entre aberturas, então limpamos o campo ao fechar —
    // senão o texto digitado antes reaparece na próxima vez que o modal abre.
    const handleClose = useCallback(() => {
        if (executando) return; // fechar no meio da exclusão deixa o usuário sem resposta
        setConfirmationInput("");
        setErro("");
        onClose();
    }, [executando, onClose]);

    // Escape fecha o modal (no Android o botão Voltar do sistema navegava pra fora
    // da página inteira, porque não havia nada escutando aqui).
    useEffect(() => {
        if (!isOpen) return;
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    const wordMatches = !requireConfirmationWord
        || normalizeWord(confirmationInput) === normalizeWord(requireConfirmationWord);
    const isConfirmDisabled = !wordMatches || executando;
    // Só reclama depois que o usuário digitou alguma coisa — campo vazio não é erro.
    const showMismatch = !!requireConfirmationWord && confirmationInput.trim().length > 0 && !wordMatches;

    /**
     * Antes era `onConfirm(); handleClose();` sem esperar: o modal sumia na hora e,
     * se a exclusão falhasse, o aviso aparecia do nada, sem contexto. Agora o modal
     * segura a tela até o servidor responder e só fecha quando deu certo.
     */
    const handleConfirm = async () => {
        if (isConfirmDisabled) return;
        setErro("");
        setExecutando(true);
        try {
            await onConfirm();
            setConfirmationInput("");
            setExecutando(false);
            onClose();
        } catch (e: unknown) {
            setExecutando(false);
            setErro(e instanceof Error && e.message ? e.message : "Não deu certo. Tente de novo.");
        }
    };

    const getVariantColors = () => {
        switch (variant) {
            case "danger": return "bg-red-600 hover:bg-red-700 text-white";
            // Branco sobre amarelo dava contraste de ~1,9:1 — ilegível no sol.
            case "warning": return "bg-yellow-500 hover:bg-yellow-600 text-yellow-950";
            default: return "bg-blue-600 hover:bg-blue-700 text-white";
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {variant === "danger" && <div className="p-2 bg-red-100 rounded-full"><AlertTriangle className="w-6 h-6 text-red-600" /></div>}
                        {variant === "warning" && <div className="p-2 bg-yellow-100 rounded-full"><AlertTriangle className="w-6 h-6 text-yellow-600" /></div>}
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={executando}
                        aria-label="Fechar"
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                    >
                        <X size={24} />
                    </button>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">
                    {description}
                </p>

                {requireConfirmationWord && (
                    <div className="mb-6">
                        <label htmlFor="confirmation-word" className="block text-sm font-medium text-gray-700 mb-2">
                            Digite <span className="font-bold select-none">{requireConfirmationWord}</span> para confirmar
                        </label>
                        <input
                            id="confirmation-word"
                            type="text"
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleConfirm();
                                }
                            }}
                            aria-invalid={showMismatch}
                            aria-describedby={showMismatch ? "confirmation-word-error" : undefined}
                            className={`w-full px-4 py-2 bg-white text-gray-900 placeholder-gray-400 border rounded-lg outline-none transition-all ${showMismatch
                                ? "border-red-400 focus:ring-2 focus:ring-red-400 focus:border-red-400"
                                : "border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"}`}
                            placeholder={requireConfirmationWord}
                        />
                        {showMismatch && (
                            <p id="confirmation-word-error" className="mt-2 text-sm font-medium text-red-600">
                                Escreva {requireConfirmationWord} pra liberar o botão.
                            </p>
                        )}
                    </div>
                )}

                {erro && (
                    <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-700">{erro}</p>
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={handleClose}
                        disabled={executando}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled}
                        className={`min-h-11 px-4 rounded-lg font-bold transition-all flex items-center gap-2 ${getVariantColors()} ${isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {executando && <Loader2 size={16} className="animate-spin" />}
                        {executando ? pendingText : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

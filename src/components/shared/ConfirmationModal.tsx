"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    requireConfirmationWord?: string; // Se setado, o usuário precisa digitar essa palavra pra confirmar
}

/**
 * Deixa a comparação tolerante: ignora maiúscula/minúscula, espaços das pontas e
 * acentos. Assim "excluir", "Excluir" e "EXCLUIR " valem a mesma coisa.
 */
function normalizeWord(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // tira acentos
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
    requireConfirmationWord
}: ConfirmationModalProps) {
    const [confirmationInput, setConfirmationInput] = useState("");

    if (!isOpen) return null;

    const wordMatches = !requireConfirmationWord
        || normalizeWord(confirmationInput) === normalizeWord(requireConfirmationWord);
    const isConfirmDisabled = !wordMatches;
    // Só reclama depois que o usuário digitou alguma coisa — campo vazio não é erro.
    const showMismatch = !!requireConfirmationWord && confirmationInput.trim().length > 0 && !wordMatches;

    // O componente fica montado entre aberturas, então limpamos o campo ao fechar —
    // senão o texto digitado antes reaparece na próxima vez que o modal abre.
    const handleClose = () => {
        setConfirmationInput("");
        onClose();
    };

    const handleConfirm = () => {
        if (isConfirmDisabled) return;
        onConfirm();
        handleClose();
    };

    const getVariantColors = () => {
        switch (variant) {
            case "danger": return "bg-red-600 hover:bg-red-700 text-white";
            case "warning": return "bg-yellow-500 hover:bg-yellow-600 text-white";
            default: return "bg-blue-600 hover:bg-blue-700 text-white";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {variant === "danger" && <div className="p-2 bg-red-100 rounded-full"><AlertTriangle className="w-6 h-6 text-red-600" /></div>}
                        {variant === "warning" && <div className="p-2 bg-yellow-100 rounded-full"><AlertTriangle className="w-6 h-6 text-yellow-600" /></div>}
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${getVariantColors()} ${isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

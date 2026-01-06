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
    requireConfirmationWord?: string; // If set, user must type this word to confirm
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

    const isConfirmDisabled = requireConfirmationWord && confirmationInput !== requireConfirmationWord;

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
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">
                    {description}
                </p>

                {requireConfirmationWord && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Digite <span className="font-bold select-none">{requireConfirmationWord}</span> para confirmar
                        </label>
                        <input
                            type="text"
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-main-500 focus:border-main-500 outline-none transition-all uppercase"
                            placeholder={requireConfirmationWord}
                        />
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            if (!isConfirmDisabled) {
                                onConfirm();
                                onClose();
                            }
                        }}
                        disabled={!!isConfirmDisabled}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${getVariantColors()} ${isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

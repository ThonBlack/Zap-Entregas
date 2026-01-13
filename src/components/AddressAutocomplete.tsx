"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, Search, X } from "lucide-react";

interface AddressAutocompleteProps {
    value: string;
    onChange: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    className?: string;
    defaultCity?: string; // Cidade padrão para priorizar resultados
    defaultState?: string; // Estado padrão
}

interface Suggestion {
    description: string;
    place_id: string;
    structured_formatting?: {
        main_text: string;
        secondary_text: string;
    };
}

// Usar a API do Google Places diretamente
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function AddressAutocomplete({
    value,
    onChange,
    placeholder = "Digite o endereço...",
    className = "",
    defaultCity = "Patos de Minas",
    defaultState = "MG"
}: AddressAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Debounce para buscar sugestões
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);

        try {
            // Adicionar cidade e estado padrão para priorizar resultados locais
            const searchQuery = `${query}, ${defaultCity}, ${defaultState}, Brasil`;

            // Usar a API de geocoding do backend para evitar expor a chave
            const res = await fetch(`/api/places/autocomplete?query=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();

            if (data.predictions) {
                setSuggestions(data.predictions);
                setShowSuggestions(true);
            }
        } catch (error) {
            console.error("Erro ao buscar sugestões:", error);
        } finally {
            setIsLoading(false);
        }
    }, [defaultCity, defaultState]);

    // Debounce input
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            fetchSuggestions(inputValue);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [inputValue, fetchSuggestions]);

    // Selecionar sugestão
    const handleSelectSuggestion = async (suggestion: Suggestion) => {
        setInputValue(suggestion.description);
        setShowSuggestions(false);
        setSuggestions([]);

        // Buscar coordenadas do endereço selecionado
        try {
            const res = await fetch(`/api/places/details?place_id=${suggestion.place_id}`);
            const data = await res.json();

            if (data.result?.geometry?.location) {
                onChange(
                    suggestion.description,
                    data.result.geometry.location.lat,
                    data.result.geometry.location.lng
                );
            } else {
                onChange(suggestion.description);
            }
        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
            onChange(suggestion.description);
        }
    };

    // Navegação por teclado
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case "Enter":
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleSelectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case "Escape":
                setShowSuggestions(false);
                break;
        }
    };

    // Limpar input
    const handleClear = () => {
        setInputValue("");
        onChange("");
        setSuggestions([]);
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            <div className="relative">
                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setSelectedIndex(-1);
                    }}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowSuggestions(true);
                        }
                    }}
                    onBlur={() => {
                        // Delay para permitir clique na sugestão
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={`w-full pl-10 pr-10 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 ${className}`}
                />
                {isLoading ? (
                    <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
                ) : inputValue && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Sugestões */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.place_id}
                            type="button"
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-zinc-700 transition-colors ${index === selectedIndex ? 'bg-zinc-700' : ''
                                }`}
                        >
                            <Search size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-white text-sm font-medium truncate">
                                    {suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0]}
                                </p>
                                <p className="text-zinc-500 text-xs truncate">
                                    {suggestion.structured_formatting?.secondary_text || suggestion.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Dica de cidade padrão */}
            {!showSuggestions && !inputValue && (
                <p className="text-xs text-zinc-600 mt-1">
                    📍 Buscando em {defaultCity}, {defaultState}
                </p>
            )}
        </div>
    );
}

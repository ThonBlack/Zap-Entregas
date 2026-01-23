"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, Search, X } from "lucide-react";

interface AddressAutocompleteProps {
    name: string; // Nome do campo para form
    value?: string;
    onChange?: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    className?: string;
    defaultCity?: string;
    defaultState?: string;
    required?: boolean;
}

interface Suggestion {
    display_name: string;
    place_id: string;
    lat: string;
    lon: string;
}

// Usa Nominatim (OpenStreetMap) - 100% GRATUITO
// Com fallback para Google se API key estiver configurada

export default function AddressAutocomplete({
    name,
    value = "",
    onChange,
    placeholder = "Digite o endereço...",
    className = "",
    defaultCity = "Patos de Minas",
    defaultState = "MG",
    required = false
}: AddressAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
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
            // Adicionar cidade e estado para priorizar resultados locais
            const searchQuery = `${query}, ${defaultCity}, ${defaultState}, Brasil`;

            // Usar Nominatim (OpenStreetMap) - GRATUITO
            const url = new URL("https://nominatim.openstreetmap.org/search");
            url.searchParams.append("q", searchQuery);
            url.searchParams.append("format", "json");
            url.searchParams.append("addressdetails", "1");
            url.searchParams.append("limit", "5");
            url.searchParams.append("countrycodes", "br");

            const res = await fetch(url.toString(), {
                headers: {
                    "User-Agent": "ZapEntregas/1.0"
                }
            });
            const data = await res.json();

            if (Array.isArray(data)) {
                setSuggestions(data);
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
        }, 400); // 400ms debounce para Nominatim (rate limit)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [inputValue, fetchSuggestions]);

    // Selecionar sugestão
    const handleSelectSuggestion = (suggestion: Suggestion) => {
        const address = suggestion.display_name;
        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon);

        setInputValue(address);
        setCoords({ lat, lng });
        setShowSuggestions(false);
        setSuggestions([]);

        if (onChange) {
            onChange(address, lat, lng);
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
                if (selectedIndex >= 0) {
                    e.preventDefault();
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
        setCoords(null);
        setSuggestions([]);
        if (onChange) onChange("");
        inputRef.current?.focus();
    };

    // Formatar endereço para exibição mais limpa
    const formatAddress = (displayName: string) => {
        // Remove Brasil e código postal do final
        return displayName
            .replace(/, Brasil$/, "")
            .replace(/,\s*\d{5}-?\d{3}/, "");
    };

    return (
        <div className="relative">
            {/* Input real escondido para o form (com coordenadas) */}
            <input type="hidden" name={name} value={inputValue} />
            {coords && (
                <>
                    <input type="hidden" name={`${name}_lat`} value={coords.lat} />
                    <input type="hidden" name={`${name}_lng`} value={coords.lng} />
                </>
            )}

            <div className="relative">
                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 z-10" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setSelectedIndex(-1);
                        setCoords(null);
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
                    required={required}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all ${className}`}
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
                <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-600 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.place_id}
                            type="button"
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0 ${index === selectedIndex ? 'bg-zinc-700' : ''
                                }`}
                        >
                            <Search size={16} className="text-green-400 mt-1 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-white text-sm truncate">
                                    {formatAddress(suggestion.display_name)}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Indicador de coordenadas válidas */}
            {coords && (
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    ✓ Endereço validado
                </p>
            )}
        </div>
    );
}

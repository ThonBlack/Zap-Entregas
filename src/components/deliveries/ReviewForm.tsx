"use client";

import { useState, useTransition } from "react";
import { Star, Send, MessageSquare, Truck, Heart } from "lucide-react";
import { submitReviewAction } from "@/app/actions/review";

interface ReviewFormProps {
    /** Token público da entrega — é ele que autoriza a avaliação, não o id. */
    token: string;
    customerName: string;
}

export default function ReviewForm({ token, customerName }: ReviewFormProps) {
    const [ratingGeneral, setRatingGeneral] = useState(0);
    const [ratingDelivery, setRatingDelivery] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [isPending, startTransition] = useTransition();
    const [submitted, setSubmitted] = useState(false);
    const [hoverGeneral, setHoverGeneral] = useState(0);
    const [hoverDelivery, setHoverDelivery] = useState(0);

    const handleSubmit = () => {
        if (ratingGeneral === 0 || ratingDelivery === 0) return;

        startTransition(async () => {
            await submitReviewAction({
                token,
                customerName,
                ratingGeneral,
                ratingDelivery,
                feedback
            });
            setSubmitted(true);
        });
    };

    if (submitted) {
        return (
            <div className="bg-zinc-800 rounded-2xl p-8 text-center border border-zinc-700">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-white mb-2">Obrigado pela avaliação!</h2>
                <p className="text-zinc-400">Seu feedback é muito importante para nós.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Avaliação Geral */}
            <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                    <Heart size={20} className="text-pink-500" />
                    <h3 className="text-white font-bold">Avaliação Geral</h3>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                    Como foi sua experiência geral? (atendimento, entrega, produtos)
                </p>
                <div className="flex justify-center">
                    <StarRating
                        value={ratingGeneral}
                        onChange={setRatingGeneral}
                        hover={hoverGeneral}
                        onHover={setHoverGeneral}
                    />
                </div>
            </div>

            {/* Avaliação da Entrega */}
            <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                    <Truck size={20} className="text-green-500" />
                    <h3 className="text-white font-bold">Avaliação da Entrega</h3>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                    Como foi o serviço do entregador?
                </p>
                <div className="flex justify-center">
                    <StarRating
                        value={ratingDelivery}
                        onChange={setRatingDelivery}
                        hover={hoverDelivery}
                        onHover={setHoverDelivery}
                    />
                </div>
            </div>

            {/* Feedback */}
            <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                    <MessageSquare size={20} className="text-blue-500" />
                    <h3 className="text-white font-bold">Comentário (opcional)</h3>
                </div>
                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Elogio, sugestão ou observação..."
                    rows={3}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-xl p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={isPending || ratingGeneral === 0 || ratingDelivery === 0}
                className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${ratingGeneral > 0 && ratingDelivery > 0
                        ? "bg-green-600 hover:bg-green-500"
                        : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    }`}
            >
                {isPending ? (
                    "Enviando..."
                ) : (
                    <>
                        <Send size={20} />
                        Enviar Avaliação
                    </>
                )}
            </button>
        </div>
    );
}

/**
 * As 5 estrelinhas. Fica FORA do componente de propósito: definida lá dentro,
 * virava um componente novo a cada render — o React remontava as estrelas do
 * zero (perde o estado do "passar por cima") toda vez que o pai renderizava.
 */
function StarRating({
    value,
    onChange,
    hover,
    onHover
}: {
    value: number;
    onChange: (v: number) => void;
    hover: number;
    onHover: (v: number) => void;
}) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => onHover(star)}
                    onMouseLeave={() => onHover(0)}
                    aria-label={`Dar ${star} estrela${star > 1 ? "s" : ""}`}
                    className="p-1 transition-transform hover:scale-110"
                >
                    <Star
                        size={36}
                        className={`transition-colors ${star <= (hover || value)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-zinc-600"
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}

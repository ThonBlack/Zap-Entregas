"use client";

import { useState, useTransition } from "react";
import { Target, Save, Loader2 } from "lucide-react";
import { updateDailyGoalAction } from "@/app/actions/settings";

interface MotoboySettingsFormProps {
    userId: number;
    currentGoal: number;
}

export default function MotoboySettingsForm({ userId, currentGoal }: MotoboySettingsFormProps) {
    const [goal, setGoal] = useState(currentGoal);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDailyGoalAction(goal);
            if (!result?.error) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Meta Diária */}
            <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                        <Target className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Meta Diária</h3>
                        <p className="text-sm text-zinc-400">Quantas entregas você quer fazer por dia?</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Quantidade de entregas
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={goal}
                                onChange={(e) => setGoal(Number(e.target.value))}
                                className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                            <div className="w-16 text-center">
                                <span className="text-2xl font-bold text-green-400">{goal}</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500 mt-1">
                            <span>1</span>
                            <span>25</span>
                            <span>50</span>
                        </div>
                    </div>

                    {/* Quick Select */}
                    <div className="flex gap-2">
                        {[5, 10, 15, 20, 30].map(n => (
                            <button
                                key={n}
                                onClick={() => setGoal(n)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${goal === n
                                        ? 'bg-green-600 text-white'
                                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                    }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={isPending || goal === currentGoal}
                className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all ${saved
                        ? 'bg-green-500'
                        : goal === currentGoal
                            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 active:scale-[0.98]'
                    }`}
            >
                {isPending ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        Salvando...
                    </>
                ) : saved ? (
                    <>
                        ✓ Salvo!
                    </>
                ) : (
                    <>
                        <Save size={20} />
                        Salvar Alterações
                    </>
                )}
            </button>
        </div>
    );
}

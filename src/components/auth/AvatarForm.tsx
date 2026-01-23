"use client";

import { updateProfileAction } from "@/app/actions/settings";
import { useActionState, useState } from "react";
import { User, Camera, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const initialState = {
    message: "",
    success: false
};

interface AvatarFormProps {
    user: {
        id: number;
        name: string;
        avatarUrl: string | null;
    };
}

export default function AvatarForm({ user }: AvatarFormProps) {
    const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);
    const [preview, setPreview] = useState<string | null>(user.avatarUrl);
    const [removeAvatar, setRemoveAvatar] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            setRemoveAvatar(false);
        }
    };

    const handleRemove = () => {
        setPreview(null);
        setRemoveAvatar(true);
    };

    return (
        <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                    <User className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">Meu Perfil</h3>
                    <p className="text-sm text-zinc-400">Personalize sua foto e nome</p>
                </div>
            </div>

            <form action={formAction} className="flex flex-col md:flex-row items-center gap-6">
                {/* Avatar Section */}
                <div className="relative group">
                    <div className={cn(
                        "w-24 h-24 rounded-full border-4 border-zinc-700 shadow-lg flex items-center justify-center overflow-hidden bg-zinc-700",
                    )}>
                        {preview ? (
                            <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-zinc-500" />
                        )}
                    </div>

                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full cursor-pointer hover:bg-green-500 transition-colors shadow-md">
                        <Camera size={14} />
                        <input
                            id="avatar-upload"
                            name="avatar"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </label>
                </div>

                {/* Info & Actions */}
                <div className="flex-1 space-y-4 w-full text-center md:text-left">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Nome</label>
                        <input
                            name="name"
                            type="text"
                            defaultValue={user.name}
                            className="w-full max-w-md p-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            placeholder="Seu nome"
                        />
                    </div>

                    <input type="hidden" name="removeAvatar" value={removeAvatar.toString()} />

                    <div className="flex flex-col md:flex-row gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar Perfil"
                            )}
                        </button>

                        {preview && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="px-4 py-3 bg-red-600/20 text-red-400 rounded-xl font-medium hover:bg-red-600/30 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} />
                                Remover Foto
                            </button>
                        )}
                    </div>

                    {state?.message && (
                        <p className={cn("text-sm font-medium mt-2", state.success ? "text-green-400" : "text-red-400")}>
                            {state.message}
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
}

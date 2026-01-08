"use client";

import { updateProfileAction } from "@/app/actions/settings";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, Upload, Trash2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const initialState = {
    message: "",
    success: false
};

interface ProfileFormProps {
    user: {
        id: number;
        name: string;
        avatarUrl: string | null;
        phone: string;
    };
}

export default function ProfileForm({ user }: ProfileFormProps) {
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
        <Card className="p-6 mb-8">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <User size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-900">Perfil da Loja</h2>
                    <p className="text-sm text-zinc-500">Gerencie sua identidade visual.</p>
                </div>
            </div>

            <form action={formAction} className="flex flex-col md:flex-row items-center gap-8">
                {/* Avatar Section */}
                <div className="relative group">
                    <div className={cn(
                        "w-32 h-32 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden bg-zinc-100",
                        !preview && "bg-zinc-100"
                    )}>
                        {preview ? (
                            <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-zinc-300" />
                        )}
                    </div>

                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-md">
                        <Camera size={16} />
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
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da Loja</label>
                        <input
                            name="name"
                            type="text"
                            defaultValue={user.name}
                            className="w-full max-w-md p-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nome do estabelecimento"
                        />
                    </div>

                    <input type="hidden" name="removeAvatar" value={removeAvatar.toString()} />

                    <div className="flex flex-col md:flex-row gap-3 pt-2">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-700 font-bold"
                        >
                            {isPending ? "Salvando..." : "Salvar Alterações"}
                        </Button>

                        {preview && (
                            <Button
                                type="button"
                                variant="danger"
                                onClick={handleRemove}
                                className="flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Remover Foto
                            </Button>
                        )}
                    </div>

                    {state?.message && (
                        <p className={cn("text-sm font-medium mt-2", state.success ? "text-green-600" : "text-red-600")}>
                            {state.message}
                        </p>
                    )}
                </div>
            </form>
        </Card>
    );
}

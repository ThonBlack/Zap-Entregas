"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { startPasskeyRegistration, finishPasskeyRegistration } from "@/app/actions/passkeys";

/**
 * Cadastrar a digital deste aparelho.
 *
 * A conversa com o navegador é sempre a mesma (pedir opções ao servidor, deixar
 * o aparelho criar a chave, mandar a resposta de volta), então mora aqui e serve
 * tanto ao card das Configurações quanto ao convite que aparece após o login.
 */
export function usePasskeyRegistration() {
    // null = ainda não sei (o teste só roda no navegador, depois de montar).
    const [suportado, setSuportado] = useState<boolean | null>(null);
    const [cadastrando, setCadastrando] = useState(false);
    const [erro, setErro] = useState("");
    const [ok, setOk] = useState("");

    useEffect(() => {
        setSuportado(browserSupportsWebAuthn());
    }, []);

    const cadastrar = useCallback(async (): Promise<boolean> => {
        setErro("");
        setOk("");
        setCadastrando(true);
        try {
            const options = await startPasskeyRegistration();
            if ("error" in options) { setErro(options.error); return false; }

            const resposta = await startRegistration({ optionsJSON: options });

            const res = await finishPasskeyRegistration(resposta);
            if ("error" in res) { setErro(res.error); return false; }

            setOk("Pronto! Agora dá pra entrar com a digital deste aparelho.");
            return true;
        } catch (e: unknown) {
            const nome = (e as { name?: string })?.name;
            if (nome === "NotAllowedError") setErro("Cadastro cancelado.");
            else if (nome === "InvalidStateError") setErro("Este aparelho já está cadastrado.");
            else setErro("Não consegui cadastrar a digital neste aparelho.");
            return false;
        } finally {
            setCadastrando(false);
        }
    }, []);

    return { suportado, cadastrando, erro, ok, setErro, setOk, cadastrar };
}

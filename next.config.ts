import type { NextConfig } from "next";

// Regras de iframe ficam no proxy (src/proxy.ts): os cabeçalhos daqui
// são resolvidos durante o build, e a imagem é construída fora do servidor.

const nextConfig: NextConfig = {
  // ATENÇÃO: NÃO volte a pôr `typescript: { ignoreBuildErrors: true }` aqui.
  // Ele existia porque o projeto tinha 13 erros de tipo; agora tem zero, e o
  // build voltou a ser uma trava de verdade. Com a checagem desligada, um erro
  // como "esta tela lê um campo que a função não devolve" passava batido e só
  // aparecia como tela branca no celular do motoboy.
  // Se um erro novo travar o build, conserte o erro — não desligue a trava.

  experimental: {
    serverActions: {
      // Tamanho máximo do que uma tela pode enviar de uma vez. O padrão do
      // Next é 1 MB, e é ele que rejeitava a foto do motoboy antes mesmo de o
      // código conferir o limite de 5 MB: foto de celular tem 2 a 4 MB, e a
      // pessoa via um erro genérico depois de ler "imagem até 5MB" na tela.
      // 6 MB dá margem pro embrulho do formulário (o arquivo viaja codificado
      // e fica um pouco maior que o original).
      bodySizeLimit: "6mb",
    },
  },

  async rewrites() {
    return [
      // O Android exige este caminho exato pra confiar que o app é do mesmo dono
      // do site (senão o app abre com a barra de endereço do Chrome à mostra).
      // Pastas começando com "." são ignoradas pelo Next, daí o desvio.
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
    ];
  },
};

export default nextConfig;

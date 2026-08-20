import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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

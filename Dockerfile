# Imagem de produção do Zap Entregas.
#
# ATENÇÃO: esta imagem é construída na MÁQUINA DO THON e viaja pronta pra VPS
# (docker save | gzip | ssh | docker load). O servidor nunca builda — não tem
# memória pra isso. Receita completa: scripts/deploy/deploy.sh e o README.
#
# Dívidas conhecidas e ACEITAS por enquanto (Docker Desktop estava fora do ar
# quando isto foi escrito, então não dava pra validar a mudança buildando):
#
#  1. `node:20` completa em vez de multi-stage + `node:20-slim`. A imagem tem
#     3,22 GB (código-fonte, node_modules de desenvolvimento, compilador). Com
#     `output: "standalone"` no next.config e dois estágios, cairia pra
#     ~300 MB — e cada deploy transfere isso pela internet. Fazer quando o
#     Docker estiver de pé pra testar de verdade.
#  2. Roda como root. `USER node` exige acertar o dono do `sqlite.db` e da pasta
#     `uploads` na VPS (hoje `644 root:root`); trocar sem isso derruba o app na
#     hora do deploy. Não vale arriscar às cegas.
FROM node:20

WORKDIR /app

# Dependências primeiro: assim o cache do Docker só é invalidado quando o
# package.json muda, e não a cada alteração de código.
COPY package*.json ./
RUN npm ci

# Copia o código. O que NÃO entra está no .dockerignore — em especial a pasta
# `android/`, que tem a chave de assinatura do aplicativo e a senha dela.
COPY . .

# ------------------------------------------------------------------------
# NEXT_PUBLIC_VAPID_PUBLIC_KEY é a única variável embutida no pacote
# JavaScript no momento do build (é ela que o navegador usa pra se inscrever
# nas notificações). Se o build for feito sem este --build-arg, a imagem sai
# com a chave vazia, o container sobe verde, o log fica limpo e a notificação
# simplesmente NUNCA chega no celular do motoboy.
#
#   docker build --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=<chave pública> \
#                -t zap-entregas:prod .
#
# O deploy.sh lê essa chave do .env.local e aborta se estiver vazia.
# Todo o resto das variáveis é lido em tempo de execução (ver .env.example).
# ------------------------------------------------------------------------
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npm run build

# Caminho do banco dentro do container (o compose monta o arquivo aqui).
ENV DATABASE_PATH=/app/sqlite.db

EXPOSE 3000

# Migrações leves rodam antes do servidor: deploy novo ou restore de backup
# antigo nunca sobe sem as colunas que o código espera. A lista e a ordem estão
# em scripts/utils/migrate_all.js (com teste que reclama se alguém esquecer um
# script novo). Se qualquer migração falhar, o `&&` impede o `npm start` e o
# container reinicia — melhor fora do ar do que rodando com o banco errado.
CMD ["sh", "-c", "node scripts/utils/migrate_all.js && npm start"]

#!/usr/bin/env bash
#
# Deploy do Zap Entregas — RODA NA MÁQUINA DO THON (Git Bash), não na VPS.
#
# Por que assim: a VPS tem 3,8 GB de memória e 14 containers. Construir o Next
# lá dentro estoura a memória, e o Compose remove o container de produção ANTES
# de construir o novo — se o build falhar, o app fica fora do ar sem nada pra
# onde voltar. Então a imagem é construída aqui e viaja pronta.
#
#   1. confere que o git está limpo e que a main já foi pro GitHub
#   2. constrói a imagem (com a chave de notificação embutida)
#   3. prova que a chave do aplicativo Android NÃO entrou na imagem
#   4. guarda a imagem que está em produção como :rollback
#   5. faz cópia do banco na VPS
#   6. manda a imagem pela rede e sobe o container
#   7. espera ficar saudável e confere o site de fora
#
# Uso:   bash scripts/deploy/deploy.sh
# Voltar atrás:  bash scripts/deploy/rollback.sh
set -euo pipefail

# ---------------------------------------------------------------- ajustes
VPS="${VPS:-root@72.61.135.4}"
PASTA_VPS="${PASTA_VPS:-/opt/zap-entregas}"
SITE="${SITE:-https://zapentregas.duckdns.org}"
IMAGEM="zap-entregas:prod"
IMAGEM_ANTERIOR="zap-entregas:rollback"
CONTAINER="zap-entregas"

# Vai pra raiz do repositório, não importa de onde o script foi chamado.
cd "$(dirname "$0")/../.."

titulo() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
erro()   { printf '\n\033[31m!! %s\033[0m\n' "$*" >&2; exit 1; }

# ------------------------------------------------------- 1. git primeiro
titulo "1/7 Conferindo o git (só sobe pra produção o que já está no GitHub)"

if [ -n "$(git status --porcelain)" ]; then
    erro "Tem alteração não commitada. Commite ou guarde antes de deployar."
fi

ramo="$(git rev-parse --abbrev-ref HEAD)"
[ "$ramo" = "main" ] || erro "Você está no ramo '$ramo'. O deploy sai da main."

git fetch --quiet origin main
local_sha="$(git rev-parse main)"
remoto_sha="$(git rev-parse origin/main)"
[ "$local_sha" = "$remoto_sha" ] || erro "main local ($(git rev-parse --short main)) != origin/main ($(git rev-parse --short origin/main)). Dê push (ou pull) antes."

echo "   main em $(git rev-parse --short main) — igual ao GitHub."

# --------------------------------------- 2. a chave de notificação (VAPID)
titulo "2/7 Lendo NEXT_PUBLIC_VAPID_PUBLIC_KEY do .env.local"

# É a ÚNICA variável embutida no pacote JavaScript durante o build. Se sair
# vazia, o container sobe verde, o log fica limpo e a notificação de corrida
# nova simplesmente nunca chega no celular do motoboy. Por isso o script para
# aqui em vez de deixar passar.
[ -f .env.local ] || erro ".env.local não existe. Copie de .env.example e preencha."

VAPID_PUB="$(grep -E '^[[:space:]]*NEXT_PUBLIC_VAPID_PUBLIC_KEY=' .env.local | tail -1 | cut -d= -f2- | tr -d '"'\''\r' | xargs || true)"
[ -n "$VAPID_PUB" ] || erro "NEXT_PUBLIC_VAPID_PUBLIC_KEY vazia no .env.local. Sem ela a notificação do motoboy morre em silêncio."

echo "   chave com ${#VAPID_PUB} caracteres, começando em ${VAPID_PUB:0:6}…"

# ------------------------------------------------------- 3. constrói aqui
titulo "3/7 Construindo a imagem (demora alguns minutos)"
docker build --build-arg "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$VAPID_PUB" -t "$IMAGEM" .

# --------------------------------------------- 4. prova que não vazou nada
titulo "4/7 Conferindo que a imagem não leva segredo dentro"

# A pasta android/ tem a chave que assina o aplicativo publicado e a senha
# dela em texto puro. A imagem viaja pela rede neste mesmo script — quem
# recebesse ela sairia com a chave. O .dockerignore exclui; isto CONFIRMA.
if docker run --rm "$IMAGEM" sh -c 'test ! -e /app/android && test ! -e /app/.env.local'; then
    echo "   ok: sem /app/android e sem /app/.env.local dentro da imagem."
else
    erro "A imagem está levando android/ ou .env.local dentro. Confira o .dockerignore e construa de novo."
fi

# --------------------------- 5. guarda a versão atual e faz cópia do banco
titulo "5/7 Guardando a versão atual e fazendo cópia do banco na VPS"

ssh "$VPS" "bash -s" <<REMOTO
set -euo pipefail
cd "$PASTA_VPS"

# Tag de rollback: a imagem que está em produção AGORA vira :rollback, antes
# de a nova chegar (o docker load sobrescreve a tag :prod).
if docker image inspect "$IMAGEM" >/dev/null 2>&1; then
    docker tag "$IMAGEM" "$IMAGEM_ANTERIOR"
    echo "   versão atual guardada como $IMAGEM_ANTERIOR"
else
    echo "   (primeiro deploy: não havia imagem anterior pra guardar)"
fi

# Cópia do banco. VACUUM INTO é o jeito certo: faz uma cópia consistente
# mesmo com o app escrevendo. Se o sqlite3 não estiver instalado, cai no cp
# simples (menos seguro, mas melhor do que nada).
carimbo=\$(date +%Y-%m-%d-%H%M)
destino="sqlite.db.bak-\$carimbo"
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 sqlite.db "VACUUM INTO '\$destino'"
    echo "   cópia do banco em $PASTA_VPS/\$destino (VACUUM INTO)"
else
    cp sqlite.db "\$destino"
    echo "   cópia do banco em $PASTA_VPS/\$destino (cp — sqlite3 não instalado)"
fi
REMOTO

# ------------------------------------------------- 6. manda a imagem e sobe
titulo "6/7 Enviando a imagem (uns 3 GB comprimidos; leva vários minutos)"
docker save "$IMAGEM" | gzip | ssh "$VPS" 'gunzip | docker load'

titulo "6/7 Subindo o container na VPS"
ssh "$VPS" "bash -s" <<REMOTO
set -euo pipefail
cd "$PASTA_VPS"
# --no-build: a imagem já chegou pronta; a VPS nunca constrói nada.
docker compose up -d --no-build
REMOTO

# ------------------------------------------------------- 7. confere se subiu
titulo "7/7 Esperando o container ficar saudável"

ssh "$VPS" "bash -s" <<REMOTO
set -euo pipefail
# O healthcheck do compose bate em /login de dentro do container. start_period
# é de 90s (o Next demora e as migrações rodam antes), então esperamos até 4min.
limite=\$(( \$(date +%s) + 240 ))
while :; do
    estado=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}' "$CONTAINER" 2>/dev/null || echo ausente)
    case "\$estado" in
        healthy)          echo "   container saudável."; break ;;
        sem-healthcheck)  echo "   (imagem/compose sem healthcheck — seguindo)"; break ;;
        unhealthy)        echo "   !! container UNHEALTHY" >&2; docker logs --tail 50 "$CONTAINER" >&2; exit 1 ;;
        ausente)          echo "   !! container $CONTAINER não existe" >&2; exit 1 ;;
    esac
    [ \$(date +%s) -lt \$limite ] || { echo "   !! passou de 4 minutos ainda em '\$estado'" >&2; docker logs --tail 50 "$CONTAINER" >&2; exit 1; }
    sleep 5
done
REMOTO

titulo "Conferindo o site de fora"
codigo="$(curl -s -o /dev/null -w '%{http_code}' -I "$SITE/login" || true)"
if [ "$codigo" = "200" ]; then
    echo "   $SITE/login respondeu 200. No ar."
else
    echo "   !! $SITE/login respondeu '$codigo' (esperado 200)." >&2
    echo "   Últimas linhas do log:" >&2
    ssh -n "$VPS" "docker logs --tail 30 $CONTAINER" >&2 || true
    erro "Deploy subiu mas o site não respondeu certo. Considere: bash scripts/deploy/rollback.sh"
fi

titulo "Últimas 30 linhas do log"
ssh -n "$VPS" "docker logs --tail 30 $CONTAINER" || true

cat <<FIM

--------------------------------------------------------------------
Deploy concluído — $(git rev-parse --short main)

Se algo estiver errado:   bash scripts/deploy/rollback.sh
Se mexeu no compose:      copie docker-compose.yml pra $PASTA_VPS na mão
Se mexeu no nginx:        copie nginx-zapentregas.conf pra
                          /etc/nginx/sites-available/zapentregas e rode
                          nginx -t && systemctl reload nginx
--------------------------------------------------------------------
FIM

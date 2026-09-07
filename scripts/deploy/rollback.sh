#!/usr/bin/env bash
#
# Voltar o Zap Entregas pra versão anterior — RODA NA MÁQUINA DO THON.
#
# O deploy.sh, antes de mandar a imagem nova, marca a que estava em produção
# como `zap-entregas:rollback`. Este script troca as duas de lugar e sobe de
# novo. Leva menos de um minuto: nada é construído nem transferido.
#
# O QUE ESTE SCRIPT **NÃO** FAZ: não desfaz mudança de banco. As migrações são
# sempre aditivas (só acrescentam coluna/tabela), então a versão antiga roda
# tranquila num banco novo. Se precisar mesmo voltar o banco, veja o fim do
# arquivo — tem a receita, e ela é manual de propósito.
#
# Uso:  bash scripts/deploy/rollback.sh
set -euo pipefail

VPS="${VPS:-root@72.61.135.4}"
PASTA_VPS="${PASTA_VPS:-/opt/zap-entregas}"
SITE="${SITE:-https://zapentregas.duckdns.org}"
IMAGEM="zap-entregas:prod"
IMAGEM_ANTERIOR="zap-entregas:rollback"
CONTAINER="zap-entregas"

titulo() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
erro()   { printf '\n\033[31m!! %s\033[0m\n' "$*" >&2; exit 1; }

titulo "Voltando o Zap Entregas pra imagem anterior"

ssh "$VPS" "bash -s" <<REMOTO
set -euo pipefail
cd "$PASTA_VPS"

if ! docker image inspect "$IMAGEM_ANTERIOR" >/dev/null 2>&1; then
    echo "!! não existe $IMAGEM_ANTERIOR nesta VPS — não há pra onde voltar." >&2
    echo "   Veja o que existe:  docker images | grep zap" >&2
    exit 1
fi

criada_atual=\$(docker image inspect --format '{{.Created}}' "$IMAGEM" 2>/dev/null || echo "-")
criada_anterior=\$(docker image inspect --format '{{.Created}}' "$IMAGEM_ANTERIOR")
echo "   em produção agora: \$criada_atual"
echo "   voltando pra:      \$criada_anterior"

# A que está no ar vira :quebrada (pra investigar depois sem perder a imagem),
# e a anterior assume o lugar de :prod, que é a tag que o compose usa.
if docker image inspect "$IMAGEM" >/dev/null 2>&1; then
    docker tag "$IMAGEM" zap-entregas:quebrada
fi
docker tag "$IMAGEM_ANTERIOR" "$IMAGEM"

docker compose up -d --no-build --force-recreate

limite=\$(( \$(date +%s) + 240 ))
while :; do
    estado=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}' "$CONTAINER" 2>/dev/null || echo ausente)
    case "\$estado" in
        healthy)         echo "   container saudável."; break ;;
        sem-healthcheck) echo "   (sem healthcheck — seguindo)"; break ;;
        unhealthy)       echo "   !! continua UNHEALTHY" >&2; docker logs --tail 50 "$CONTAINER" >&2; exit 1 ;;
        ausente)         echo "   !! container $CONTAINER não existe" >&2; exit 1 ;;
    esac
    [ \$(date +%s) -lt \$limite ] || { echo "   !! passou de 4 minutos em '\$estado'" >&2; docker logs --tail 50 "$CONTAINER" >&2; exit 1; }
    sleep 5
done
REMOTO

titulo "Conferindo o site de fora"
codigo="$(curl -s -o /dev/null -w '%{http_code}' -I "$SITE/login" || true)"
[ "$codigo" = "200" ] || erro "$SITE/login respondeu '$codigo' (esperado 200). Olhe: ssh $VPS 'docker logs --tail 50 $CONTAINER'"
echo "   $SITE/login respondeu 200. No ar na versão anterior."

titulo "Últimas 30 linhas do log"
ssh -n "$VPS" "docker logs --tail 30 $CONTAINER" || true

cat <<FIM

--------------------------------------------------------------------
Voltou. A imagem com defeito ficou guardada como zap-entregas:quebrada
(pra investigar; apague depois com: docker rmi zap-entregas:quebrada).

ATENÇÃO: o BANCO não foi tocado. As migrações do Zap são só aditivas, então
a versão antiga roda bem num banco já migrado. Se mesmo assim precisar voltar
o banco, faça na mão e com o container PARADO — trocar o arquivo com ele de pé
não adianta (o container fica preso ao arquivo antigo até reiniciar):

  ssh $VPS
  cd $PASTA_VPS
  ls -lt sqlite.db.bak-*          # escolha a cópia
  docker compose stop
  cp sqlite.db sqlite.db.antes-do-restore
  cp sqlite.db.bak-<data> sqlite.db
  docker compose up -d --no-build
--------------------------------------------------------------------
FIM

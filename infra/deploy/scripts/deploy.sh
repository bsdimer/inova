#!/usr/bin/env bash
# Roll the stack forward to a given image tag. Run on the host by
# .github/workflows/deploy.yml, or by hand:
#
#   bash /opt/inova/scripts/deploy.sh <image-tag>
#
# Order matters: the database must exist and the app role must have the right
# password before api/auth-service start, or they crash-loop on connect.
set -euo pipefail

STACK_DIR=${STACK_DIR:-/opt/inova}
IMAGE_TAG=${1:?usage: deploy.sh <image-tag>}
SEED=${SEED:-false}

cd "$STACK_DIR"

log() { echo "==> $*"; }

log "pinning IMAGE_TAG=$IMAGE_TAG"
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|" .env
# shellcheck source=/dev/null
set -a && . ./.env && set +a

# SKIP_PULL exists for the bootstrap deploy, where images were side-loaded
# with `docker load` before the registry was in play. CI never sets it.
if [ "${SKIP_PULL:-false}" != "true" ]; then
  log "pulling images"
  docker compose pull --quiet
fi

log "starting data services"
docker compose up -d postgres redis

log "running migrations"
docker compose run --rm migrator

# 0001/0002 create inova_app with a well-known development password. Re-set it
# to the generated one on every deploy: cheap, idempotent, and it means a
# freshly restored database never sits with the default.
log "syncing the app role password"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -v ON_ERROR_STOP=1 -U inova -d inova \
  -c "ALTER ROLE inova_app WITH PASSWORD '$APP_DB_PASSWORD'" >/dev/null

if [ "$SEED" = "true" ]; then
  log "seeding demo data"
  docker compose run --rm seed
fi

log "starting application services"
docker compose up -d --remove-orphans

log "waiting for health"
deadline=$((SECONDS + 120))
for service in auth-service api; do
  until [ "$(docker compose ps --format '{{.Health}}' "$service" 2>/dev/null)" = "healthy" ]; do
    if [ $SECONDS -ge $deadline ]; then
      echo "FAILED: $service did not become healthy" >&2
      docker compose ps
      docker compose logs --tail 60 "$service" >&2
      exit 1
    fi
    sleep 3
  done
  log "$service healthy"
done

log "reloading nginx"
# Config files are bind-mounted, so a changed config needs an explicit reload;
# `up -d` will not recreate the container for a file-content change.
#
# But a bind-mounted directory that was replaced on the host (rather than
# rewritten in place) leaves the container holding the old, unlinked inode,
# which it sees as empty. Reloading into that state silently strips nginx of
# every listen directive and takes the site down while still reporting
# success. Compare what the container sees with what is on disk first.
host_config_sum=$(md5sum "$STACK_DIR/nginx/conf.d/portal.conf" | cut -d' ' -f1)
container_config_sum=$(docker compose exec -T nginx md5sum /etc/nginx/conf.d/portal.conf 2>/dev/null | cut -d' ' -f1 || true)
if [ "$host_config_sum" != "$container_config_sum" ]; then
  log "nginx is not seeing the current config — recreating the container"
  docker compose up -d --force-recreate nginx
else
  docker compose exec -T nginx nginx -t
  docker compose exec -T nginx nginx -s reload
fi

log "verifying through the proxy"
curl -fsS --max-time 10 "https://$DOMAIN/api/v1/health" >/dev/null
curl -fsS --max-time 10 "https://$DOMAIN/auth/v1/health" >/dev/null
curl -fsS --max-time 10 -o /dev/null "https://$DOMAIN/"

log "pruning old images"
docker image prune -af --filter "until=168h" >/dev/null || true

log "deployed $IMAGE_TAG"

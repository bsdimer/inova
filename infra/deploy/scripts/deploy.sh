#!/usr/bin/env bash
# Roll one environment's app stack forward to an image tag. Run on the host by
# .github/workflows/deploy.yml, or by hand:
#
#   bash /opt/inova-test/scripts/deploy.sh <image-tag>
#
# The stack is the directory this script was synced into (<stack>/scripts/).
# Order matters: the database must exist and the app role must have the right
# password before api/auth-service start, or they crash-loop on connect.
set -euo pipefail

STACK_DIR=${STACK_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
NEW_TAG=${1:?usage: deploy.sh <image-tag>}
SEED=${SEED:-false}

cd "$STACK_DIR"

# shellcheck source=/dev/null
set -a && . ./.env && set +a

log() { echo "==> [$ENV_NAME] $*"; }

# The seed creates demo logins with publicly documented passwords. Refuse it
# anywhere but test, whatever the caller asked for — and before anything on the
# host has been changed.
if [ "$SEED" = "true" ] && [ "$ENV_NAME" != "test" ]; then
  echo "REFUSED: SEED=true is only allowed in the test environment (this is $ENV_NAME)" >&2
  exit 1
fi

# Pin the tag in .env so a manual `docker compose` later uses the same images,
# and export it: Compose prefers the shell environment over .env, and the
# value sourced above is the previous tag.
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$NEW_TAG|" .env
export IMAGE_TAG=$NEW_TAG

if ! docker network inspect edge >/dev/null 2>&1 \
  || [ -z "$(docker ps -q --filter label=com.docker.compose.project=edge --filter status=running)" ]; then
  echo "FAILED: the edge proxy is not running on this host." >&2
  echo "It is provisioned by production deploys; run one before deploying $ENV_NAME." >&2
  exit 1
fi

log "deploying $IMAGE_TAG to $DOMAIN"

# SKIP_PULL exists for bootstrap deploys, where images were side-loaded with
# `docker load` before the registry was in play. CI never sets it.
if [ "${SKIP_PULL:-false}" != "true" ]; then
  log "pulling images"
  docker compose pull --quiet
fi

log "starting data services"
docker compose up -d postgres redis

log "running migrations"
docker compose run --rm migrator

# 0001/0002 create inova_app with a well-known development password. Re-set it
# to this environment's generated one on every deploy: cheap, idempotent, and a
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
for service in auth-service api admin; do
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

# Pinned to this host rather than resolved through public DNS: the deploy is
# answerable for the edge proxy, TLS, routing and the app — not for a DNS
# record it cannot change, and a DNS outage must not block shipping a fix.
log "verifying through the edge proxy"
verify() { curl -fsS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "$@"; }
verify "https://$DOMAIN/api/v1/health" >/dev/null
verify "https://$DOMAIN/auth/v1/health" >/dev/null
verify -o /dev/null "https://$DOMAIN/"

# Public DNS is reported, not enforced. The ::warning:: line surfaces as an
# annotation on the GitHub Actions run.
if ! getent hosts "$DOMAIN" >/dev/null; then
  echo "::warning::$DOMAIN does not resolve in public DNS — the deploy succeeded but users cannot reach it by name"
fi

log "pruning images unused for a week"
docker image prune -af --filter "until=168h" >/dev/null || true

log "deployed $IMAGE_TAG"

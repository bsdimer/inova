#!/usr/bin/env bash
# Bring the edge proxy in line with /opt/edge: certificates first, then start
# or reload nginx. Run by test deploys while test is the only environment; once
# production exists it should be run by production deploys only, because the
# proxy will then carry production traffic.
#
#   bash /opt/edge/scripts/deploy-edge.sh
set -euo pipefail

EDGE_DIR=${EDGE_DIR:-/opt/edge}
cd "$EDGE_DIR"

log() { echo "==> [edge] $*"; }

# A site file that references a certificate which does not exist yet fails
# `nginx -t`, so every hostname gets its certificate before any reload.
log "ensuring certificates"
grep -vE '^\s*(#|$)' domains | while read -r domain; do
  bash "$EDGE_DIR/scripts/obtain-cert.sh" "$domain"
done

container_config_sum() {
  docker compose exec -T nginx sh -c 'cat /etc/nginx/conf.d/* | md5sum' 2>/dev/null | cut -d' ' -f1 || true
}

if [ -z "$(docker compose ps -q --status running nginx)" ]; then
  log "starting the proxy"
  docker compose up -d
else
  # A bind-mounted directory that was replaced on the host (rather than
  # rewritten in place) leaves the container holding the old, unlinked inode,
  # which it sees as empty. Reloading into that state strips nginx of every
  # listen directive while reporting success. Compare what the container sees
  # with what is on disk first. LC_ALL=C matches busybox's glob order.
  host_sum=$(LC_ALL=C bash -c 'cat conf.d/* | md5sum' | cut -d' ' -f1)
  if [ "$host_sum" != "$(container_config_sum)" ]; then
    log "proxy is not seeing the current config — recreating it"
    docker compose up -d --force-recreate nginx
  else
    log "validating and reloading"
    docker compose exec -T nginx nginx -t
    docker compose exec -T nginx nginx -s reload
  fi
fi

log "waiting for health"
deadline=$((SECONDS + 60))
until [ "$(docker compose ps --format '{{.Health}}' nginx)" = "healthy" ]; do
  if [ $SECONDS -ge $deadline ]; then
    echo "FAILED: edge proxy did not become healthy" >&2
    docker compose logs --tail 40 nginx >&2
    exit 1
  fi
  sleep 3
done
log "edge proxy healthy"

# Health only proves the container is alive, and a reload does not reset it —
# it cannot tell a working reload from one that dropped every listener. Check
# that each hostname completes a verified TLS handshake on 443. Any HTTP status
# counts: a 502 still proves nginx is serving that site with a valid
# certificate even if its app stack is not deployed yet.
grep -vE '^\s*(#|$)' domains | while read -r domain; do
  code=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' \
    --resolve "$domain:443:127.0.0.1" "https://$domain/" || true)
  if [ "$code" = "000" ]; then
    echo "FAILED: $domain is not served over TLS by the edge proxy" >&2
    exit 1
  fi
  log "$domain answers over TLS (HTTP $code)"
done

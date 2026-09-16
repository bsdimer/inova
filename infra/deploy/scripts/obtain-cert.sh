#!/usr/bin/env bash
# Issue the initial Let's Encrypt certificate for $DOMAIN.
#
# Renewals do NOT use this script — see renew-certs.sh. This one exists because
# nginx cannot start before the certificate file exists (its 443 server block
# references it), so the first issuance has to happen with nginx down, using
# certbot's standalone listener on port 80.
#
# Idempotent: exits early if a certificate is already present.
set -euo pipefail

STACK_DIR=${STACK_DIR:-/opt/inova}
# shellcheck source=/dev/null
[ -f "$STACK_DIR/.env" ] && set -a && . "$STACK_DIR/.env" && set +a

DOMAIN=${DOMAIN:?DOMAIN is not set}
ACME_EMAIL=${ACME_EMAIL:?ACME_EMAIL is not set}
CERTBOT_IMAGE=certbot/certbot:latest

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "certificate for $DOMAIN already exists — nothing to do"
  exit 0
fi

echo "==> stopping anything on port 80 so certbot can bind it"
docker compose --project-directory "$STACK_DIR" stop nginx 2>/dev/null || true

echo "==> requesting certificate for $DOMAIN (HTTP-01, standalone)"
docker run --rm \
  -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  "$CERTBOT_IMAGE" certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$ACME_EMAIL" \
  --keep-until-expiring \
  -d "$DOMAIN"

echo "==> issued:"
ls -l "/etc/letsencrypt/live/$DOMAIN/"

#!/usr/bin/env bash
# Issue the first Let's Encrypt certificate for one hostname. Renewals are
# renew-certs.sh, not this script.
#
#   bash /opt/edge/scripts/obtain-cert.sh test-portal.whitenova.tech
#
# Idempotent: exits early if the certificate already exists.
#
# If the edge proxy is running, the challenge is answered over its webroot — its
# default server serves /.well-known/acme-challenge/ for any Host, so a new
# hostname needs no site file yet and nothing goes down. On a fresh host with
# no proxy yet, certbot binds port 80 itself (standalone).
set -euo pipefail

DOMAIN=${1:?usage: obtain-cert.sh <hostname>}
ACME_EMAIL=${ACME_EMAIL:-bsdimer@gmail.com}
CERTBOT_IMAGE=certbot/certbot:latest
WEBROOT_VOLUME=${WEBROOT_VOLUME:-edge_certbot-webroot}

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "certificate for $DOMAIN already exists"
  exit 0
fi

edge_running=$(docker ps -q \
  --filter "label=com.docker.compose.project=edge" \
  --filter "label=com.docker.compose.service=nginx" \
  --filter "status=running")

common=(--non-interactive --agree-tos --email "$ACME_EMAIL" --keep-until-expiring -d "$DOMAIN")

if [ -n "$edge_running" ]; then
  echo "==> requesting certificate for $DOMAIN (HTTP-01 over the edge webroot)"
  docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/lib/letsencrypt:/var/lib/letsencrypt \
    -v "$WEBROOT_VOLUME":/var/www/certbot \
    "$CERTBOT_IMAGE" certonly --webroot --webroot-path /var/www/certbot "${common[@]}"
else
  echo "==> requesting certificate for $DOMAIN (HTTP-01, standalone on :80)"
  docker run --rm \
    -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/lib/letsencrypt:/var/lib/letsencrypt \
    "$CERTBOT_IMAGE" certonly --standalone "${common[@]}"
fi

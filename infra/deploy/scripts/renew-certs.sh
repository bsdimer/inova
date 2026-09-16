#!/usr/bin/env bash
# Automatic renewal, run twice daily by the inova-certbot-renew systemd timer.
#
# Uses HTTP-01 over the webroot nginx already serves, so there is no downtime
# and port 80 stays bound by nginx. certbot renews only when the certificate is
# within 30 days of expiry; the deploy-hook marker means nginx is reloaded only
# on an actual renewal rather than twice a day for nothing.
set -euo pipefail

STACK_DIR=${STACK_DIR:-/opt/inova}
# shellcheck source=/dev/null
[ -f "$STACK_DIR/.env" ] && set -a && . "$STACK_DIR/.env" && set +a

CERTBOT_IMAGE=certbot/certbot:latest
WEBROOT_VOLUME=${WEBROOT_VOLUME:-inova_certbot-webroot}
MARKER=/etc/letsencrypt/.renewed

rm -f "$MARKER"

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v "$WEBROOT_VOLUME":/var/www/certbot \
  "$CERTBOT_IMAGE" renew \
  --webroot --webroot-path /var/www/certbot \
  --non-interactive \
  --deploy-hook "touch $MARKER"

if [ -f "$MARKER" ]; then
  echo "certificate renewed — reloading nginx"
  docker compose --project-directory "$STACK_DIR" exec -T nginx nginx -s reload
  rm -f "$MARKER"
else
  echo "nothing due for renewal"
fi

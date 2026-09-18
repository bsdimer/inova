#!/usr/bin/env bash
# Automatic renewal of every certificate on the host, run twice daily by the
# inova-certbot-renew systemd timer.
#
# Uses HTTP-01 over the webroot the edge proxy already serves, so there is no
# downtime and port 80 stays with nginx. certbot renews only certificates within
# 30 days of expiry; the deploy-hook marker means nginx is reloaded only after
# an actual renewal rather than twice a day for nothing.
set -euo pipefail

EDGE_DIR=${EDGE_DIR:-/opt/edge}
CERTBOT_IMAGE=certbot/certbot:latest
WEBROOT_VOLUME=${WEBROOT_VOLUME:-edge_certbot-webroot}
MARKER=/etc/letsencrypt/.renewed

rm -f "$MARKER"

# certbot exits non-zero if ANY certificate fails to renew (for example one
# whose DNS record was removed). The others may still have renewed, so capture
# the status instead of letting `set -e` exit before the reload — otherwise a
# freshly renewed certificate sits unused on disk until the old one expires.
status=0
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v "$WEBROOT_VOLUME":/var/www/certbot \
  "$CERTBOT_IMAGE" renew \
  --webroot --webroot-path /var/www/certbot \
  --non-interactive \
  --deploy-hook "touch $MARKER" || status=$?

if [ -f "$MARKER" ]; then
  echo "certificate renewed — reloading the edge proxy"
  docker compose --project-directory "$EDGE_DIR" exec -T nginx nginx -s reload
  rm -f "$MARKER"
else
  echo "nothing renewed"
fi

# Still fail the unit when a renewal failed, so it shows in the journal and in
# `systemctl --failed`.
exit "$status"

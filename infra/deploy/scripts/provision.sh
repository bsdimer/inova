#!/usr/bin/env bash
# Host-level setup shared by every environment. Idempotent; run as root.
#
#   bash /opt/edge/scripts/provision.sh
#
# Per-environment setup (credentials, JWT key) is provision-env.sh. The edge
# proxy and its certificates are deploy-edge.sh.
set -euo pipefail

EDGE_DIR=${EDGE_DIR:-/opt/edge}

log() { echo "==> $*"; }

log "installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg openssl ufw unattended-upgrades >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker Engine from the official repository"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
else
  log "Docker already installed: $(docker --version)"
fi

# Two environments share 3.7 GB. A deploy briefly runs old and new containers
# side by side — swap is the cheap insurance against the OOM killer picking a
# Postgres during that overlap.
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  log "creating 2G swapfile"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  sysctl -q -w vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >>/etc/sysctl.conf
else
  log "swap already configured"
fi

# Only touch ufw when it is not already in the wanted state: enabling it
# reloads the ruleset, which is needless churn under Docker's own rules.
if ! ufw status | grep -q '^Status: active'; then
  log "configuring firewall"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
else
  log "firewall already active"
fi
# Docker publishes ports by writing its own iptables rules, which bypass ufw.
# Postgres and Redis are therefore given no `ports:` mapping at all rather than
# being firewalled after the fact.

if ! docker network inspect edge >/dev/null 2>&1; then
  log "creating the shared edge network"
  docker network create edge >/dev/null
else
  log "edge network already exists"
fi

log "installing the certificate renewal timer"
install -m 0644 "$EDGE_DIR/systemd/inova-certbot-renew.service" /etc/systemd/system/
install -m 0644 "$EDGE_DIR/systemd/inova-certbot-renew.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now inova-certbot-renew.timer >/dev/null

log "host provisioning complete"

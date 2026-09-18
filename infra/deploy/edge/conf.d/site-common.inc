# Shared by every environment's HTTPS server. The including server block sets
# $app_env (prod | test), which selects that environment's containers by their
# alias on the shared `edge` network: <env>-api, <env>-auth, <env>-admin.
#
# Named .inc, not .conf: nginx.conf auto-includes conf.d/*.conf into the http
# block, and these directives belong inside a server.

ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
# No ssl_stapling: Let's Encrypt certificates no longer carry an OCSP responder
# URL, so nginx ignores it and warns on every reload.

add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Headroom for the issue-photo uploads that land in M3.
client_max_body_size 10m;

location /api/ {
    set $core_api "http://${app_env}-api:4000";
    rewrite ^/api/?(.*)$ /$1 break;
    include /etc/nginx/conf.d/proxy-common.inc;
    proxy_pass $core_api;
}

location /auth/ {
    set $auth_service "http://${app_env}-auth:4001";
    limit_req zone=auth_zone burst=20 nodelay;
    rewrite ^/auth/?(.*)$ /$1 break;
    include /etc/nginx/conf.d/proxy-common.inc;
    proxy_pass $auth_service;
}

location / {
    set $admin "http://${app_env}-admin:80";
    include /etc/nginx/conf.d/proxy-common.inc;
    proxy_pass $admin;
}

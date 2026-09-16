# Shared upstream headers, included by every proxying location.
# Named .inc, not .conf: nginx.conf auto-includes conf.d/*.conf into the
# http block, and these directives belong in a location.
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Connection "";
proxy_connect_timeout 5s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;

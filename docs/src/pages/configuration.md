---
layout: ../layouts/DocsLayout.astro
title: Configuration
prev: { text: "Features", href: "features" }
next: { text: "TLS Setup", href: "tls-setup" }
---

# Configuration

All configuration is via a `.env` file in the project root.

## Environment variables

| Variable     | Default               | Description                     |
| ------------ | --------------------- | ------------------------------- |
| `PORT`       | `5173`                | Server port                     |
| `UPLOAD_DIR` | `./uploads`           | File upload directory           |
| `FILE_ROOT`  | cwd                   | Root directory for file browser |
| `TLS_CERT`   |                       | Path to TLS certificate file    |
| `TLS_KEY`    |                       | Path to TLS private key file    |
| `VAULT_FILE` | `.wormhole-vault.enc` | Path to encrypted vault blob    |

## Example `.env`

```sh
PORT=8080
UPLOAD_DIR=/tmp/wormhole-uploads
TLS_CERT=/home/you/.local/share/tailscale/cert.pem
TLS_KEY=/home/you/.local/share/tailscale/key.pem
```

## Running behind a reverse proxy

If you run Wormhole behind nginx or Caddy, make sure WebSocket upgrade
headers are forwarded. Example nginx config:

```nginx
location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

With a reverse proxy handling TLS, you do not need to set `TLS_CERT` and
`TLS_KEY` — Wormhole will run plain HTTP and the proxy terminates TLS.

## Auto-start with systemd

A user-level systemd service lets Wormhole start automatically when you
log in. Create `~/.config/systemd/user/wormhole.service`:

```ini
[Unit]
Description=Wormhole server
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/path/to/wormhole
ExecStart=%h/.nvm/versions/node/vX.Y.Z/bin/node node_modules/.bin/tsx src/server.ts
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

Update `WorkingDirectory` and `ExecStart` to match your setup. `%h`
expands to your home directory. If you use nvm, point `ExecStart` to
your nvm node binary (run `which node` to find it).

Then enable and start:

```sh
systemctl --user enable --now wormhole
```

To keep the service running even when you are not logged in:

```sh
loginctl enable-linger $USER
```

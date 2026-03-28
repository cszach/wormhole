---
layout: ../layouts/DocsLayout.astro
title: TLS Setup
prev: { text: "Configuration", href: "configuration" }
next: { text: "Command Palette", href: "command-palette" }
---

# TLS Setup

HTTPS is required for:

- **Voice dictation** — the Web Speech API requires a secure context
- **Password vault** — the vault refuses to unlock over plain HTTP
- **Web Crypto API** — used for vault encryption

`localhost` and `127.0.0.1` are treated as secure contexts by browsers, so
TLS is only needed when connecting from another device.

## Tailscale (recommended)

If you use [Tailscale](https://tailscale.com), you can get a free TLS
certificate for your machine:

```sh
sudo tailscale cert \
  --cert-file ~/.local/share/tailscale/cert.pem \
  --key-file ~/.local/share/tailscale/key.pem \
  <hostname>.<tailnet>.ts.net
```

Add the paths to your `.env`:

```sh
TLS_CERT=/home/you/.local/share/tailscale/cert.pem
TLS_KEY=/home/you/.local/share/tailscale/key.pem
```

Then connect via `https://<hostname>.<tailnet>.ts.net:5173`.

## Self-signed certificate

Generate a self-signed cert:

```sh
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem -out cert.pem -days 365 \
  -subj "/CN=wormhole"
```

Add to `.env`:

```sh
TLS_CERT=./cert.pem
TLS_KEY=./key.pem
```

Your browser will show a security warning. Accept it once and the
connection will work.

> **Warning:** Self-signed certificates are fine for personal use on your
> own network. Do not use them in production or on shared networks.

## Let's Encrypt

If your machine has a public domain name, use
[certbot](https://certbot.eff.org):

```sh
sudo certbot certonly --standalone -d yourdomain.com
```

Add to `.env`:

```sh
TLS_CERT=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Reverse proxy

If you already run nginx or Caddy with TLS, you can skip Wormhole's
built-in TLS and let the proxy terminate it. See
[Configuration](../configuration/#running-behind-a-reverse-proxy).

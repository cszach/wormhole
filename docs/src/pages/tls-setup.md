---
layout: ../layouts/DocsLayout.astro
title: TLS Setup
prev: { text: "Configuration", href: "configuration" }
next: { text: "Sessions", href: "sessions" }
---

# TLS Setup

HTTPS is required for voice input, the password vault, and clipboard
operations. `localhost` and `127.0.0.1` count as secure, so TLS is only
needed when connecting from another device.

## Tailscale (recommended)

If you use [Tailscale](https://tailscale.com), get a free TLS certificate:

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

Your browser will show a security warning — accept it once. Fine for
personal use on your own network.

## Let's Encrypt

For a machine with a public domain:

```sh
sudo certbot certonly --standalone -d yourdomain.com
```

Add to `.env`:

```sh
TLS_CERT=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Reverse proxy

If you already run nginx or Caddy with TLS, skip Wormhole's built-in TLS
and let the proxy handle it. See
[Configuration](../configuration/#running-behind-a-reverse-proxy).

---
layout: ../layouts/DocsLayout.astro
title: Troubleshooting
prev: { text: "Themes & Customization", href: "themes" }
next: { text: "How it works", href: "how-it-works" }
---

# Troubleshooting

## Cannot connect from phone

**Check the server is running:**

```sh
curl http://localhost:5173
```

**Check your firewall:**

```sh
sudo ufw allow 5173
```

**Check your network.** Your phone and machine must be on the same LAN,
or connected via Tailscale / VPN.

## Port already in use

```sh
fuser -k 5173/tcp
```

Then restart the server.

## Voice input not working

Requires HTTPS. Set up [TLS](../tls-setup/) or access via `localhost`.

## Vault won't unlock

Requires HTTPS, `localhost`, or `127.0.0.1`. Set up
[TLS](../tls-setup/).

If you forgot your master password, tap "Reset vault" in the vault
drawer. This permanently deletes all stored credentials.

## Clipboard paste not working

**Linux:** install `xclip`:

```sh
sudo apt install xclip    # Debian/Ubuntu
sudo dnf install xclip    # Fedora
sudo pacman -S xclip      # Arch
```

**macOS:** `pbcopy` is included by default.

**Timeout:** the clipboard auto-clears after a configurable timeout
(default 30s). Increase it in Settings > Password Vault if needed.

## tmux not found

```sh
sudo apt install tmux     # Debian/Ubuntu
sudo dnf install tmux     # Fedora
brew install tmux         # macOS
```

## Terminal output looks garbled

Adjust the column width in Settings > Terminal. Try switching to manual
and setting 80 columns.

## Background notifications not appearing

Notifications only fire after a background session's output stabilizes.
Blank sessions do not trigger them.

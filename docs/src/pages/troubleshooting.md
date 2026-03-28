---
layout: ../layouts/DocsLayout.astro
title: Troubleshooting
prev: { text: "Architecture", href: "architecture" }
---

# Troubleshooting

## Cannot connect from phone

**Check the server is running:**

```sh
curl http://localhost:5173
```

**Check your firewall:**

```sh
# Allow port 5173 (Linux with ufw)
sudo ufw allow 5173
```

**Check you're on the same network.** Your phone and machine must be on
the same LAN, or connected via Tailscale / VPN.

## Port already in use

If you see `EADDRINUSE`:

```sh
# Find and kill the process using the port
fuser -k 5173/tcp
```

Then restart the server.

## Voice dictation not working

The Web Speech API requires a secure context. Set up
[TLS](../tls-setup/) or access Wormhole via `localhost`.

## Vault won't unlock

The vault requires HTTPS, `localhost`, or `127.0.0.1`. If you see the
HTTPS warning in the vault section, set up [TLS](../tls-setup/).

If you forgot your master password, use "Reset vault" in settings. This
permanently deletes all stored credentials.

## Clipboard paste not working

**Linux:** Make sure `xclip` is installed:

```sh
sudo apt install xclip    # Debian/Ubuntu
sudo dnf install xclip    # Fedora
sudo pacman -S xclip      # Arch
```

**macOS:** `pbcopy` is included by default.

**Timeout:** The clipboard auto-clears after a configurable timeout
(default 30 seconds). If you take longer to paste, increase the timeout
in settings or set it to "never."

## tmux not found

Wormhole requires tmux to be installed and in your PATH:

```sh
sudo apt install tmux     # Debian/Ubuntu
sudo dnf install tmux     # Fedora
brew install tmux         # macOS
```

## Terminal output looks garbled

Try adjusting the column width in settings. If auto-columns gives
unexpected results, switch to manual and set a value like 80.

## Background notifications not appearing

Background session polling only runs when an active session exists.
Notifications appear after a background session's output stabilizes
(stops changing for 2 seconds). Blank sessions do not trigger
notifications.

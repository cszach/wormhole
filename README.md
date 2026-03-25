# Wormhole

Talk to Claude Code from your phone.

Wormhole is a web app that runs on the same machine as Claude Code and gives
you a mobile interface to control it -- voice in, voice out, image attachments,
and full terminal output with colors. Access it from any device on your network.

## How it works

Claude Code runs in a tmux session. Wormhole connects to that session: it sends
your input via `tmux send-keys` and streams the terminal output back to your
browser via WebSocket. Your phone's browser provides the mic, speakers, and
camera that a terminal can't.

```
Phone Browser ----> Wormhole Server ----> tmux ----> Claude Code
      ^                   |
      +--- WebSocket <----+
```

## Features

- **Voice** -- dictate prompts, hear responses read aloud (full or summary mode)
- **Images** -- attach from camera or gallery, multiple at once
- **Live terminal** -- ANSI colors, auto-scroll
- **Multi-session** -- switch between tmux sessions, create and delete from the
  app
- **Context-aware keys** -- Claude Code layout (Shift+Tab, Ctrl+O, Ctrl+C) vs
  terminal layout (Home, End, PgUp, PgDn, sticky Ctrl/Alt/Shift modifiers)
- **Themes** -- animated GLSL shader backgrounds (Starry Night, Aurora, Nebula,
  Topography)
- **Customizable** -- accent color, TTS voice/speed, terminal column width

## Prerequisites

- Node.js
- tmux
- Optional: [Tailscale](https://tailscale.com) for secure access from your phone

## Setup

```sh
npm install
```

Run Wormhole:

```sh
npm run dev
```

Open `http://<your-ip>:5173` on your phone. You can create and switch between
tmux sessions from the session picker in the header.

### HTTPS (required for voice dictation)

The Web Speech API requires a secure context. If you use Tailscale, you can get
a free TLS certificate:

```sh
sudo tailscale cert \
  --cert-file ~/.local/share/tailscale/cert.pem \
  --key-file ~/.local/share/tailscale/key.pem \
  <hostname>.<tailnet>.ts.net
```

Then add the paths to your `.env`:

```
TLS_CERT=/home/you/.local/share/tailscale/cert.pem
TLS_KEY=/home/you/.local/share/tailscale/key.pem
```

## Configuration

All configuration is via a `.env` file in the project root. Available variables:

| Variable     | Default     | Description             |
| ------------ | ----------- | ----------------------- |
| `PORT`       | `5173`      | Server port             |
| `UPLOAD_DIR` | `./uploads` | Image upload directory  |
| `TLS_CERT`   |             | Path to TLS certificate |
| `TLS_KEY`    |             | Path to TLS private key |

## Testing

```sh
npm test
```

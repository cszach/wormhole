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
- **Live terminal** -- ANSI colors, auto-scroll, Claude Code UI stripped out
- **Controls** -- arrow keys, Enter, Esc, permission mode cycling
- **Themes** -- animated GLSL shader backgrounds, switchable in settings
- **Customizable** -- accent color, TTS voice/speed, terminal column width

## Prerequisites

- Node.js
- tmux with a running session (default name: `claude`)
- Optional: [Tailscale](https://tailscale.com) for secure access from your phone

## Setup

```sh
npm install
```

Start Claude Code in tmux:

```sh
tmux new -s claude
claude
```

Run Wormhole:

```sh
npm run dev
```

Open `http://<your-ip>:5173` on your phone.

### HTTPS (required for voice dictation)

The Web Speech API requires a secure context. If you use Tailscale, you can get
a free TLS certificate:

```sh
sudo tailscale cert \
  --cert-file ~/.local/share/tailscale/cert.pem \
  --key-file ~/.local/share/tailscale/key.pem \
  <hostname>.<tailnet>.ts.net
```

Then run with TLS:

```sh
TLS_CERT=~/.local/share/tailscale/cert.pem \
TLS_KEY=~/.local/share/tailscale/key.pem \
npm run dev
```

## Configuration

| Variable       | Default   | Description             |
| -------------- | --------- | ----------------------- |
| `PORT`         | `5173`    | Server port             |
| `TMUX_SESSION` | `claude`  | tmux session name       |
| `UPLOAD_DIR`   | `./uploads` | Image upload directory |
| `TLS_CERT`     |           | Path to TLS certificate |
| `TLS_KEY`      |           | Path to TLS private key |

## Testing

```sh
npm test
```

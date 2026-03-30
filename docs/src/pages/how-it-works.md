---
layout: ../layouts/DocsLayout.astro
title: How it works
prev: { text: "Troubleshooting", href: "troubleshooting" }
---

# How it works

```
Phone Browser ──── WebSocket ────> Wormhole Server ────> tmux
     ^                                   |
     └───────── WebSocket <──────────────┘
```

Wormhole is three layers:

1. **Client** — a single-page app in your phone's browser
2. **Server** — a Node.js process on your machine
3. **tmux** — the terminal multiplexer running your shell

## Client

A vanilla TypeScript app with no framework. Key modules:

| Module             | Role                                  |
| ------------------ | ------------------------------------- |
| `connection.ts`    | WebSocket lifecycle, message dispatch |
| `render.ts`        | ANSI-to-HTML output, linkification    |
| `input.ts`         | Message sending, key buttons, upload  |
| `file-browser.ts`  | File browser with search and preview  |
| `vault.ts`         | Vault state, credential actions       |
| `vault-crypto.ts`  | AES-256-GCM encryption                |
| `linkify.ts`       | Clickable URLs and file paths         |
| `quick-preview.ts` | File preview from terminal links      |
| `power-menu.ts`    | Long-press menu                       |
| `state.ts`         | Shared state across modules           |

## Server

An Express + WebSocket server that:

- Serves the static client
- Polls tmux for output changes and broadcasts them
- Handles file uploads and the file tree API
- Stores the encrypted vault blob
- Manages clipboard injection (`xclip` / `pbcopy`)

## tmux interaction

| Operation      | Command                                 |
| -------------- | --------------------------------------- |
| Capture output | `tmux capture-pane -p -t <session>`     |
| Send text      | `tmux send-keys -t <session> <text>`    |
| Send key       | `tmux send-keys -t <session> <key>`     |
| Resize         | `tmux resize-window -t <session> -x N`  |
| List sessions  | `tmux list-sessions -F #{session_name}` |
| Paste buffer   | `tmux set-buffer` + `paste-buffer`      |

## Polling

- **Active session** — polled every 250ms. After 2 seconds of stability,
  a `stable` event fires (used for TTS).
- **Background sessions** — polled every 2 seconds. Stability triggers
  the notification badge.

## WebSocket protocol

Messages are JSON with a `type` field.

**Client to server:**

| Type              | Description                         |
| ----------------- | ----------------------------------- |
| `send`            | Text and optional file paths        |
| `key`             | Key press                           |
| `resize`          | Terminal column width               |
| `ping`            | Latency measurement                 |
| `switch`          | Switch session                      |
| `vault-inject`    | Paste credential into tmux          |
| `vault-clipboard` | Copy credential to system clipboard |

**Server to client:**

| Type                  | Description                     |
| --------------------- | ------------------------------- |
| `output`              | Terminal content update         |
| `stable`              | Output stopped changing         |
| `session`             | Active session name             |
| `pong`                | Latency response                |
| `bg-stable`           | Background session has activity |
| `bg-clear`            | Background notification cleared |
| `vault-inject-ack`    | Credential paste result         |
| `vault-clipboard-ack` | Clipboard copy result           |

---
layout: ../layouts/DocsLayout.astro
title: Architecture
prev: { text: "Themes & Customization", href: "themes" }
next: { text: "Troubleshooting", href: "troubleshooting" }
---

# Architecture

## Overview

```
Phone Browser ──── WebSocket ────> Wormhole Server ────> tmux
     ^                                   |
     └───────── WebSocket <──────────────┘
```

Wormhole is a three-layer system:

1. **Client** — a single-page app running in your phone's browser
2. **Server** — a Node.js process on your machine
3. **tmux** — the terminal multiplexer that runs your shell and programs

## Client

The client is a vanilla TypeScript app bundled with esbuild into an IIFE.
No framework — just DOM manipulation, a WebSocket connection, and the Web
Crypto API for the vault.

Key modules:

| Module               | Responsibility                                 |
| -------------------- | ---------------------------------------------- |
| `connection.ts`      | WebSocket lifecycle, message dispatch          |
| `render.ts`          | ANSI-to-HTML terminal output, linkification    |
| `linkify.ts`         | Detect URLs and file paths, make clickable     |
| `quick-preview.ts`   | Standalone file preview from terminal links    |
| `input.ts`           | Message sending, key buttons, file upload      |
| `command-palette.ts` | Searchable command/skill/snippet palette       |
| `vault.ts`           | Vault state, unlock/lock, credential actions   |
| `vault-crypto.ts`    | AES-256-GCM encryption via Web Crypto API      |
| `vault-drawer.ts`    | Full-screen vault drawer UI                    |
| `file-browser.ts`    | Full-screen file browser with syntax highlight |
| `power-menu.ts`      | Long-press power menu (files, vault, browser)  |
| `state.ts`           | Shared mutable state across modules            |
| `dom.ts`             | Centralized DOM element references             |

## Server

An Express + WebSocket server (`server.ts`) that:

- Serves the static client files
- Polls tmux every 250ms for terminal output changes
- Broadcasts output to all connected WebSocket clients
- Handles image uploads via multipart form data
- Stores and serves the encrypted vault blob
- Manages clipboard injection via `xclip` / `pbcopy`

## tmux interaction

The server communicates with tmux via shell commands (`tmux.ts`):

| Operation      | tmux command                            |
| -------------- | --------------------------------------- |
| Capture output | `tmux capture-pane -p -t <session>`     |
| Send text      | `tmux send-keys -t <session> <text>`    |
| Send key       | `tmux send-keys -t <session> <key>`     |
| Resize         | `tmux resize-window -t <session> -x N`  |
| List sessions  | `tmux list-sessions -F #{session_name}` |
| Paste buffer   | `tmux set-buffer` + `paste-buffer`      |

## Polling model

The server polls tmux at two intervals:

- **Active session** — every 250ms. Changes are broadcast immediately.
  After 2 seconds of stability, a `stable` event is sent (used for TTS).
- **Background sessions** — every 2 seconds. When a background session
  stabilizes, a `bg-stable` event triggers the notification badge.

## WebSocket messages

Messages are JSON objects with a `type` field.

**Client to server:**

| Type              | Description                         |
| ----------------- | ----------------------------------- |
| `send`            | Send text and optional file paths   |
| `key`             | Send a key press                    |
| `resize`          | Set terminal column width           |
| `ping`            | Latency measurement                 |
| `switch`          | Switch active session               |
| `vault-inject`    | Paste credential into tmux          |
| `vault-clipboard` | Copy credential to system clipboard |

**Server to client:**

| Type                  | Description                             |
| --------------------- | --------------------------------------- |
| `output`              | Terminal content update                 |
| `stable`              | Output stopped changing                 |
| `session`             | Active session name                     |
| `pong`                | Latency response                        |
| `bg-stable`           | Background session has new output       |
| `bg-clear`            | Background session notification cleared |
| `vault-inject-ack`    | Credential paste result                 |
| `vault-clipboard-ack` | Clipboard copy result                   |

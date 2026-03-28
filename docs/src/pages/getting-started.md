---
layout: ../layouts/DocsLayout.astro
title: Getting Started
next: { text: "Features", href: "features" }
---

# Getting Started

## Prerequisites

- **Node.js** 18 or later
- **tmux** installed and available in your PATH
- A machine on the same network as your phone

## Install

Run the install script:

```sh
curl -sL https://raw.githubusercontent.com/cszach/wormhole/main/install.sh | sh
```

Or clone manually:

```sh
git clone https://github.com/cszach/wormhole.git
cd wormhole
npm install
```

## Start the server

```sh
cd wormhole
npm run dev
```

This builds the client and starts the server on port 5173. Wormhole
automatically creates a tmux session if none exists.

## Connect from your phone

Open your browser and navigate to:

```
http://<your-machine-ip>:5173
```

You should see the terminal output streaming live. Type a message and tap
Send to send it to tmux.

> **Tip:** Find your machine's IP with `hostname -I` on Linux or
> `ipconfig getifaddr en0` on macOS.

## Next steps

- [Set up TLS](../tls-setup/) for voice dictation and the password vault
- [Explore features](../features/) to see what Wormhole can do
- [Configure](../configuration/) the server with environment variables

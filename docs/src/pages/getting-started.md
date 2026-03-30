---
layout: ../layouts/DocsLayout.astro
title: Getting Started
next: { text: "Features", href: "features" }
---

# Getting Started

## Prerequisites

- **Node.js** 20 or later
- **tmux** installed and in your PATH
- A machine on the same network as your phone

## Install

Run the install script:

```sh
curl -sL https://raw.githubusercontent.com/cszach/wormhole/main/install.sh | sh
```

The installer checks dependencies, clones the repo, installs packages,
and offers to start the server for you. Pass `--start` to skip the
prompt and start automatically.

Or install manually:

```sh
git clone https://github.com/cszach/wormhole.git
cd wormhole
npm install
```

## Start the server

```sh
npm run dev
```

Wormhole builds the client and starts the server on port 5173. A tmux
session is created if none exists.

## Connect from your phone

Open your browser and go to:

```
http://<your-machine-ip>:5173
```

Terminal output streams live. Type a message and tap Send to push it
to tmux.

> **Tip:** Find your machine's IP with `hostname -I` on Linux or
> `ipconfig getifaddr en0` on macOS.

## Next steps

- [Set up TLS](../tls-setup/) for voice input and the password vault
- [Explore features](../features/) to see what Wormhole can do
- [Configure](../configuration/) the server to your needs

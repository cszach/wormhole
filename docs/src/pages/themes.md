---
layout: ../layouts/DocsLayout.astro
title: Themes & Customization
prev: { text: "Keyboard Controls", href: "keyboard" }
next: { text: "Architecture", href: "architecture" }
---

# Themes & Customization

## Shader backgrounds

Wormhole renders animated backgrounds using GLSL shaders on a WebGL
canvas. Available themes:

| Theme        | Description           |
| ------------ | --------------------- |
| Starry Night | Twinkling star field  |
| Aurora       | Northern lights waves |
| Nebula       | Cosmic gas clouds     |
| Topography   | Contour map lines     |

Select a theme in settings under the Themes section.

## Accent colors

Choose from 8 accent colors that tint the UI:

Lavender, Cyan, Emerald, Rose, Amber, Coral, Teal, White.

The accent color affects buttons, active states, borders, and highlights
throughout the app. Your choice is saved in local storage and also applies
to the docs pages.

## PWA install

Wormhole is a Progressive Web App. To install it on your phone:

**iOS Safari:**

1. Tap the Share button
2. Tap "Add to Home Screen"

**Android Chrome:**

1. Tap the three-dot menu
2. Tap "Add to Home Screen" or "Install app"

The installed app uses the wormhole tunnel grid icon and launches in
standalone mode without the browser chrome.

## Terminal columns

In settings, you can set the terminal column width:

- **Auto** (default) — calculates columns based on your screen width
- **Manual** — set a specific column count with the slider (40–300)

The column width is sent to tmux when you connect or change the setting.

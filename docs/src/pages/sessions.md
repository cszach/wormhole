---
layout: ../layouts/DocsLayout.astro
title: Sessions
prev: { text: "TLS Setup", href: "tls-setup" }
next: { text: "Keyboard Controls", href: "keyboard" }
---

# Sessions

Wormhole manages multiple tmux sessions from your phone.

## Session picker

Tap the session name in the header to open the picker. It shows all
active sessions, the current one highlighted, a latency readout, and
green dots next to sessions with new activity.

## Switching

Tap a session name to switch. Output updates immediately.

## Creating

Type a name in the "New session" field and tap Create. Wormhole switches
to the new session automatically.

Names must be 20 characters or fewer and cannot contain `.` or `:`.

## Deleting

Tap the **x** next to a session. You cannot delete the last remaining
session. Deleting the active session switches to another one.

## Background notifications

When a background session has new output that stabilizes, a notification
appears in the header hint showing how many sessions have activity.

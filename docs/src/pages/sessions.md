---
layout: ../layouts/DocsLayout.astro
title: Sessions
prev: { text: "Snippets", href: "snippets" }
next: { text: "Password Vault", href: "vault" }
---

# Sessions

Wormhole supports multiple tmux sessions that you can manage from
your phone.

## Session picker

Tap the session name in the header to open the session picker. It shows:

- All active tmux sessions
- The current session (highlighted)
- A latency readout
- Background activity indicators (green dots)

## Switching sessions

Tap a session name in the picker to switch to it. The terminal output
updates immediately to show the new session's content.

## Creating sessions

Type a name in the "New session" field and tap Create. The app
automatically switches to the new session.

Session names must be:

- 20 characters or fewer
- Cannot contain `.` or `:`
- Cannot be empty

## Deleting sessions

Tap the **x** button next to a session. You cannot delete the last
remaining session.

If you delete the active session, Wormhole automatically switches to
another one.

## Background notifications

When a background session has new output that stabilizes (stops changing
for 2 seconds), a notification appears in the session hint below the
header, showing how many sessions have new activity. Green dots appear
next to those sessions in the picker.

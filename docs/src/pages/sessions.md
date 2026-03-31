---
layout: ../layouts/DocsLayout.astro
title: Sessions
prev: { text: "TLS Setup", href: "tls-setup" }
next: { text: "Keyboard Controls", href: "keyboard" }
---

# Sessions

Wormhole manages tmux sessions and windows from your phone.

## Session drawer

Tap the session name in the header to open the session drawer. It shows
all sessions with their window counts, the active session highlighted,
and green dots next to sessions with new activity. A search bar filters
by session name or window name.

## Switching

Tap a session with one window to switch directly. Tap a session with
multiple windows to expand it and see its windows — then tap a window
to switch to it. The header hint shows the active window name.

## Windows

Each session can have multiple tmux windows. Expand a session to see
its windows listed with their index and name. Tap "+ New window" at
the bottom of the list to create one.

Swipe left on a window row to reveal Rename and Delete actions. You
cannot delete the last window in a session.

## Creating sessions

Tap the **+** button in the drawer header. Type a name and tap Create.
Names must be 20 characters or fewer and cannot contain `.` or `:`.

## Renaming and deleting

Swipe left on a session or window row to reveal Rename and Delete.
Rename opens an inline text input. You cannot delete the last
remaining session.

## Background notifications

When a background session's active window has new output that
stabilizes, a notification appears in the header hint showing how many
sessions have activity.

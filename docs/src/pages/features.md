---
layout: ../layouts/DocsLayout.astro
title: Features
prev: { text: "Getting Started", href: "getting-started" }
next: { text: "Configuration", href: "configuration" }
---

# Features

An overview of what Wormhole gives you.

## Live terminal

Terminal output streams to your phone in real-time via WebSocket. ANSI
colors are rendered, and the view auto-scrolls as new output arrives. Tap
the scroll button to jump back to the bottom if you scroll up.

## Claude Code detection

Wormhole detects when Claude Code is running and switches to a tailored
key layout with shortcuts like Shift+Tab (accept), Ctrl+C (interrupt), and
Ctrl+O (bypass). When Claude Code is not active, a general terminal layout
appears with Home, End, PgUp, PgDn, and sticky modifier keys.

## Voice input & TTS

Dictate prompts with your phone's microphone. Responses can be read aloud
in full or summary mode, with configurable voice and speed. Requires
[HTTPS](../tls-setup/).

## File attachments

Attach photos from your camera or gallery with a short tap on the image
button. For any file type, long-press to open the power menu and choose
Attach files. Multiple files can be sent in a single message. Files are
uploaded to the server and their paths are included in the message to
Claude.

## Command palette

A searchable palette for built-in Claude Code commands, custom skills,
and saved snippets. Opens automatically when you type `/` in Claude Code
mode. See [Command Palette](../command-palette/).

## Multi-session

Create, switch, and delete tmux sessions from the session picker. When a
background session has new activity, a notification badge appears. See
[Sessions](../sessions/).

## Password vault

An encrypted credential store for injecting passwords into the terminal or
the server's clipboard without exposing them to Claude. Access the vault
from the power menu (long-press the image or snippets button). See
[Password Vault](../vault/).

## Snippets

Save frequently used commands or text blocks and recall them from the
command palette or the snippets button. Tap a snippet to edit it in a
modal. See [Snippets](../snippets/).

## Output search

Search through terminal output with highlighted matches and
previous/next navigation.

## Themes

Animated GLSL shader backgrounds — Starry Night, Aurora, Nebula, and
Topography — plus configurable accent colors. See
[Themes & Customization](../themes/).

## Draft auto-save

Your unsent message is saved to local storage as you type, so you don't
lose it if the page refreshes.

## File browser

Browse files on the server in a full-screen drawer with syntax
highlighting, search, and breadcrumb navigation. Open it from the power
menu.

## Power menu

Long-press the image button (in Claude Code mode) or the snippets button
(in terminal mode) to open the power menu. It offers three options:
Attach files, Password Vault, and File Browser.

## Connection indicator

A latency dot in the header shows your connection quality with color-coded
thresholds (green, yellow, red) and a ping readout in the session picker.

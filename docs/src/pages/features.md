---
layout: ../layouts/DocsLayout.astro
title: Features
prev: { text: "Getting Started", href: "getting-started" }
next: { text: "Configuration", href: "configuration" }
---

# Features

## Live terminal

Terminal output streams to your phone in real-time. ANSI colors render
faithfully, and the view auto-scrolls as new output arrives.

## Clickable output

URLs in terminal output open in a new tab. File paths open a quick
preview with syntax highlighting. Bare filenames like `server.ts` are
resolved against the project file tree — if there is exactly one match,
it links.

## Claude Code detection

Wormhole detects when Claude Code is running and shows a tailored key
layout with Shift+Tab (accept), Ctrl+C (interrupt), and Ctrl+O (bypass).
Otherwise, a general terminal layout appears with Home, End, PgUp, PgDn,
and sticky modifiers.

## File attachments

Short-tap the image button to attach photos. Long-press to open the
power menu and choose Attach files for any file type.

## File browser

Browse server files in a full-screen drawer with breadcrumb navigation,
search, and syntax highlighting. Markdown files render with full
formatting. Open from the [power menu](#power-menu).

## File viewer

Previewing a file — from the file browser or by tapping a path in
terminal output — opens the file viewer. It shows the file path and
configurable subtext (file size, type, or last modified). Tab width is
also configurable. Both settings are in Settings > File Viewer.

## Command palette

A searchable list of Claude Code commands, custom skills, and saved
snippets. Opens when you type `/` in Claude Code mode. See
[Command Palette](../command-palette/).

## Sessions & windows

Manage tmux sessions and windows from a full-screen drawer. Sessions
expand to show their windows. Create, rename, and delete sessions and
windows with swipe actions. Background sessions show activity
notifications. See [Sessions](../sessions/).

## Password vault

An encrypted credential store for injecting passwords into the terminal
without exposing them to Claude. See [Password Vault](../vault/).

## Snippets

Save and recall frequently used commands or text blocks. See
[Snippets](../snippets/).

## Voice input & TTS

Dictate with your phone's microphone. Responses can be read aloud in
summary or full mode. Requires [HTTPS](../tls-setup/). See
[Speech & TTS](../speech/).

## Output search

Search terminal output with highlighted matches and previous/next
navigation.

## Power menu

Long-press the image button (Claude Code mode) or the snippets button
(terminal mode) for quick access to Attach files, Password Vault, and
File Browser.

## Themes

Animated backgrounds and configurable accent colors. See
[Themes & Customization](../themes/).

## Connection indicator

A color-coded dot in the header shows connection quality. The session
picker displays the latency.

## Draft auto-save

Your unsent message persists across page refreshes.

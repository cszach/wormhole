---
layout: ../layouts/DocsLayout.astro
title: Command Palette
prev: { text: "TLS Setup", href: "tls-setup" }
next: { text: "Snippets", href: "snippets" }
---

# Command Palette

The command palette gives you quick access to Claude Code commands, custom
skills, and saved snippets.

## Opening the palette

Type `/` as the first character in the text input while in Claude Code
mode. The palette opens automatically with all available commands.

## Sections

### Built-in commands

These are standard Claude Code slash commands:

| Command    | Description          |
| ---------- | -------------------- |
| `/help`    | Show help            |
| `/compact` | Compact conversation |
| `/context` | Show context usage   |
| `/clear`   | Clear conversation   |
| `/cost`    | Show token costs     |
| `/memory`  | Edit memory          |
| `/mcp`     | MCP server status    |
| `/skills`  | List skills          |
| `/config`  | Show config          |

### Custom skills

Skills you add in settings appear in the palette prefixed with `/`. When
selected, they are inserted into the text input for you to send.

### Snippets

Saved text blocks appear in the palette. Selecting a snippet fills the
text input with its content. See [Snippets](../snippets/).

## Search

Type in the search field to filter across all sections. The filter matches
against command names and descriptions.

---
layout: ../layouts/DocsLayout.astro
title: Command Palette
prev: { text: "Keyboard Controls", href: "keyboard" }
next: { text: "Snippets", href: "snippets" }
---

# Command Palette

Quick access to Claude Code commands, custom skills, and saved snippets.

## Opening

Type `/` as the first character in the text input while in Claude Code
mode. The palette opens with all available commands.

## Sections

### Built-in commands

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

Skills added in settings appear prefixed with `/`. Selecting one inserts
it into the text input. You can also sync skills from Claude Code's
skill files via the Sync button in settings.

### Snippets

Saved text blocks appear under the Snippets section. Selecting one fills
the text input. See [Snippets](../snippets/).

## Search

Type to filter across all sections by name or description.

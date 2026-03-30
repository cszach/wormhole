---
layout: ../layouts/DocsLayout.astro
title: Password Vault
prev: { text: "Speech & TTS", href: "speech" }
next: { text: "Themes & Customization", href: "themes" }
---

# Password Vault

An encrypted credential store for injecting passwords into the terminal
without exposing them to Claude or any AI model.

## How it works

1. You set a **master password** the first time you open the vault.
2. Credentials are encrypted in your browser using **AES-256-GCM** with a
   key derived via **PBKDF2** (600,000 iterations, SHA-256).
3. The server stores only the **encrypted blob**. It never sees plaintext.
4. When you use a credential, you choose how to inject it:
   - **Terminal paste** — sends directly into tmux.
   - **Remote clipboard** — copies to the server's system clipboard.

## Requirements

The vault requires a [secure context](../tls-setup/) (HTTPS, localhost,
or 127.0.0.1). It will not unlock over plain HTTP.

## Managing credentials

Open the vault from the power menu (long-press the image button in Claude
Code mode or the snippets button in terminal mode). Enter your master
password to unlock.

- **Add** — tap the **+** button, fill in the label and password, then
  tap Add
- **Search** — filter credentials by label
- **Delete** — tap the **x** next to a credential
- **Lock** — tap Lock or wait for auto-lock

## Injection modes

### Terminal paste

Injects directly into the active tmux pane. The tmux buffer is cleared
immediately after paste.

Best for: `sudo`, SSH, GPG prompts, and any terminal input.

### Remote clipboard

Copies to the server machine's system clipboard (`xclip` on Linux,
`pbcopy` on macOS). Auto-cleared after a configurable timeout.

Best for: browser password fields. Have Claude focus the field, then
paste with Ctrl+V.

## Settings

In the settings panel under Password Vault:

- **Auto-lock** — 1 minute, 5 minutes (default), 10 minutes, 30 minutes,
  or never
- **Clipboard clear** — 10 seconds, 30 seconds (default), 1 minute, or
  never

## Reset

If you forget your master password, tap "Reset vault" in the vault
drawer. This permanently deletes all stored credentials.

## Where your password exists

| Location           | Form                    | Duration            |
| ------------------ | ----------------------- | ------------------- |
| Vault file on disk | Encrypted (AES-256-GCM) | Persistent          |
| In transit         | Encrypted (TLS/HTTPS)   | Milliseconds        |
| Server memory      | Plaintext               | Milliseconds        |
| tmux paste buffer  | Plaintext               | Cleared after paste |
| System clipboard   | Plaintext               | Auto-cleared        |
| Claude's context   | **Never**               | N/A                 |

## Security considerations

**What Wormhole protects against:**

- **Network sniffing** — HTTPS encrypts credentials in transit
- **Disk theft** — the vault file is AES-256-GCM encrypted
- **AI exposure** — credentials bypass Claude entirely
- **Buffer leaks** — tmux buffer and clipboard are cleared automatically

**What Wormhole cannot protect against:**

- **Compromised machine** — root access exposes process memory
- **Weak master password** — encryption is only as strong as the password
- **Terminal echo** — if a program echoes the password, Claude can see it
- **Clipboard managers** — third-party tools may log credentials before
  auto-clear

## How it works (technical)

| Detail              | Value                                                |
| ------------------- | ---------------------------------------------------- |
| Encryption          | AES-256-GCM (authenticated encryption)               |
| Key derivation      | PBKDF2, 600,000 iterations, SHA-256                  |
| Salt                | 16 bytes, random, regenerated on every save          |
| Nonce               | 12 bytes, random, regenerated on every save          |
| Terminal injection  | `tmux set-buffer` + `paste-buffer` + `delete-buffer` |
| Clipboard injection | `xclip` (Linux) / `pbcopy` (macOS)                   |
| Server access       | Encrypted blob only — never sees plaintext or key    |

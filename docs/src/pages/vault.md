---
layout: ../layouts/DocsLayout.astro
title: Password Vault
prev: { text: "Sessions", href: "sessions" }
next: { text: "Speech & TTS", href: "speech" }
---

# Password Vault

Wormhole includes an encrypted password vault for injecting credentials
into your terminal or browser without exposing them to Claude or any AI
model.

## How it works

1. You set a **master password** the first time you open the vault.
2. Credentials are encrypted in your browser using **AES-256-GCM** with a
   key derived from your master password via **PBKDF2** (600,000
   iterations, SHA-256).
3. The Wormhole server stores only the **encrypted blob** on disk. It
   never sees your plaintext passwords.
4. When you use a credential, you choose how to inject it:
   - **Terminal paste** sends it directly into tmux.
   - **Remote clipboard** copies it to the server's system clipboard for
     browser fields.

## Requirements

The vault requires a [secure context](../tls-setup/) (HTTPS, localhost,
or 127.0.0.1). It will not unlock over plain HTTP.

## Managing credentials

Open settings and scroll to the Vault section. Enter your master password
to unlock.

- **Add** — fill in the label and password fields, then tap Add
- **Delete** — tap the **x** button next to a credential
- **Lock** — tap the Lock button or wait for auto-lock

## Two injection modes

Each credential in the [command palette](../command-palette/) offers two
actions:

### Terminal paste

Injects directly into the active tmux pane via `set-buffer` +
`paste-buffer`. The tmux buffer is cleared immediately after paste.

Best for: `sudo`, SSH, GPG prompts, and any terminal input.

### Remote clipboard

Copies to the server machine's system clipboard (`xclip` on Linux,
`pbcopy` on macOS). The clipboard is auto-cleared after a configurable
timeout (default 30 seconds).

Best for: browser password fields. Tell Claude to focus the field, then
paste with Ctrl+V.

> **Tip:** Example workflow — "Go to instagram.com, enter my username, and
> focus the password field. I'll handle the password." Then use the vault
> to paste via remote clipboard.

## Auto-lock

The vault automatically locks after a configurable timeout. Options: 1
minute, 5 minutes (default), 10 minutes, 30 minutes, or never.

## Clipboard clear

The remote clipboard is automatically cleared after injection. Options:
10 seconds, 30 seconds (default), 1 minute, 5 minutes, or never.

## Reset vault

If you forget your master password, tap "Reset vault" in settings. This
permanently deletes all stored credentials and cannot be undone.

## Where your password exists

| Location                  | Form                    | Duration            |
| ------------------------- | ----------------------- | ------------------- |
| Vault file on disk        | Encrypted (AES-256-GCM) | Persistent          |
| Phone to server (network) | Encrypted (TLS/HTTPS)   | Milliseconds        |
| Server process memory     | Plaintext               | Milliseconds        |
| tmux paste buffer         | Plaintext               | Cleared after paste |
| System clipboard          | Plaintext               | Auto-cleared        |
| Claude's context          | **Never**               | N/A                 |

## Security considerations

**What Wormhole protects against:**

- **Network sniffing** — HTTPS encrypts credentials in transit
- **Disk theft** — the vault file is AES-256-GCM encrypted
- **AI exposure** — credentials bypass Claude entirely
- **Buffer leaks** — tmux buffer and clipboard are cleared automatically

**What Wormhole cannot protect against:**

- **Compromised machine** — root access means full access to process
  memory
- **Weak master password** — encryption strength depends on password
  strength
- **Terminal echo** — if a program echoes the password, Claude can see it
- **Clipboard managers** — third-party clipboard history tools may log the
  credential before auto-clear

## Technical details

| Spec                | Description                                            |
| ------------------- | ------------------------------------------------------ |
| Encryption          | AES-256-GCM (authenticated encryption)                 |
| Key derivation      | PBKDF2, 600,000 iterations, SHA-256                    |
| Salt                | 16 bytes, random, regenerated on every save            |
| Nonce               | 12 bytes, random, regenerated on every save            |
| Crypto engine       | Web Crypto API (client-side only)                      |
| Terminal injection  | `tmux set-buffer` -> `paste-buffer` -> `delete-buffer` |
| Clipboard injection | `xclip` (Linux) / `pbcopy` (macOS)                     |
| Clipboard clear     | Configurable (10s, 30s, 1m, 5m, never)                 |
| Auto-lock           | Configurable (1m, 5m, 10m, 30m, never)                 |
| Vault reset         | Deletes encrypted blob permanently                     |
| Server access       | Encrypted blob only — never sees plaintext or key      |

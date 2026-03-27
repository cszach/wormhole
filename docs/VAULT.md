# Password Vault Security

Wormhole includes an encrypted password vault for injecting credentials into
your terminal or browser without exposing them to Claude or any AI model.

## How it works

1. You set a **master password** the first time you open the vault.
2. Credentials are encrypted in your browser using **AES-256-GCM** with a key
   derived from your master password via **PBKDF2** (600,000 iterations,
   SHA-256).
3. The Wormhole server stores only the **encrypted blob** on disk. It never sees
   your plaintext passwords.
4. When you use a credential, you choose how to inject it:
   - **Terminal paste** sends it directly into tmux.
   - **Remote clipboard** copies it to the server's system clipboard for browser
     fields.

## Where your password exists

| Location                  | Form                    | Duration            |
| ------------------------- | ----------------------- | ------------------- |
| Vault file on disk        | Encrypted (AES-256-GCM) | Persistent          |
| Phone to server (network) | Encrypted (TLS/HTTPS)   | Milliseconds        |
| Server process memory     | Plaintext               | Milliseconds        |
| tmux paste buffer         | Plaintext               | Cleared after paste |
| System clipboard          | Plaintext               | Auto-cleared        |
| Claude's context          | **Never**               | N/A                 |

## What Wormhole protects against

- **Network sniffing** -- HTTPS encrypts credentials in transit. The vault
  refuses to unlock over plain HTTP.
- **Disk theft** -- the vault file is encrypted with AES-256-GCM. Without your
  master password, it is computationally infeasible to decrypt.
- **AI exposure** -- credentials are never sent through the chat. They bypass
  Claude entirely via tmux or the system clipboard.
- **Buffer leaks** -- the tmux paste buffer is cleared immediately after
  injection. The system clipboard is auto-cleared after a configurable timeout.

## What Wormhole cannot protect against

- **Compromised machine** -- if an attacker has root access to the machine
  running Wormhole, they can read process memory, install keyloggers, or
  modify the server code. This is the same trust model as typing a password
  on your keyboard.
- **Compromised phone** -- malware on your phone can read screen contents and
  intercept input.
- **Weak master password** -- the encryption is only as strong as your master
  password. A short or common password can be brute-forced against the encrypted
  vault file.
- **DOM inspection** -- after a credential is pasted into a browser field via
  Claude's Chrome automation, Claude could theoretically read the page DOM. Most
  sites use `<input type="password">` which browsers protect, but this is not
  guaranteed.
- **Terminal echo** -- if the target program echoes the password to the terminal
  (most don't), it would appear in the captured output that Claude can see.
- **Clipboard managers** -- third-party clipboard history tools may log the
  credential before it is auto-cleared. This is the same risk as any password
  manager that uses the clipboard.

## Two injection modes

Each credential offers two actions in the command palette:

**Terminal paste** -- injects directly into the active tmux pane via
`set-buffer` + `paste-buffer`. Best for `sudo`, SSH, GPG prompts, and any
terminal input. The tmux buffer is cleared immediately after paste. Claude never
sees the value.

**Remote clipboard** -- copies to the server machine's system clipboard (via
`xclip` on Linux or `pbcopy` on macOS). The clipboard is auto-cleared after a
configurable timeout (default 30 seconds). Best for browser password fields --
tell Claude to focus the field, then paste with Ctrl+V.

## Recommended usage

1. **Always use HTTPS.** The vault will not unlock over HTTP.
2. **Choose a strong master password.** It protects all your stored credentials.
3. **For terminal prompts** (sudo, SSH), use terminal paste -- it goes directly
   into tmux.
4. **For browser fields**, use remote clipboard, then tell Claude to focus the
   field and press Ctrl+V. Example: "Go to instagram.com, enter my username, and
   focus the password field. I'll handle the password."
5. **Lock the vault when you're done.** It auto-locks after a configurable
   timeout (default 5 minutes).

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

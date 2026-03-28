---
layout: ../layouts/DocsLayout.astro
title: Speech & TTS
prev: { text: "Password Vault", href: "vault" }
next: { text: "Keyboard Controls", href: "keyboard" }
---

# Speech & TTS

Wormhole uses the Web Speech API for voice input and text-to-speech
output.

## Voice input

Tap the microphone button to start dictating. Your speech is transcribed
and appended to the text input. Tap again to stop.

> **Info:** Voice input requires a [secure context](../tls-setup/)
> (HTTPS). The microphone button is disabled over plain HTTP.

## Text-to-speech

When enabled, Wormhole reads Claude's responses aloud after the terminal
output stabilizes (stops changing for 2 seconds).

### TTS modes

| Mode    | Behavior                                                  |
| ------- | --------------------------------------------------------- |
| Summary | Extracts prose paragraphs, skipping code blocks and diffs |
| Full    | Reads the entire latest response                          |

### Settings

Open settings to configure:

- **Enable/disable** — the TTS toggle
- **Mode** — summary or full
- **Rate** — speech speed (0.5x to 2.0x)
- **Voice** — choose from your system's available voices

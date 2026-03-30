---
layout: ../layouts/DocsLayout.astro
title: Speech & TTS
prev: { text: "Snippets", href: "snippets" }
next: { text: "Password Vault", href: "vault" }
---

# Speech & TTS

## Voice input

Tap the microphone button to dictate. Speech is transcribed and appended
to the text input. Tap again to stop.

Requires [HTTPS](../tls-setup/). The microphone button is disabled over
plain HTTP.

## Text-to-speech

When enabled, Wormhole reads Claude's responses aloud once the output
stabilizes.

| Mode    | Behavior                                     |
| ------- | -------------------------------------------- |
| Summary | Reads prose paragraphs, skips code and diffs |
| Full    | Reads the entire response                    |

## Settings

In the settings panel:

- **Enabled** — toggle TTS on or off
- **Mode** — summary or full
- **Speed** — 0.5x to 2.0x
- **Voice** — choose from your system's available voices

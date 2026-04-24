---
layout: ../layouts/DocsLayout.astro
title: Phone Messaging Opt-In Consent
---

# Phone Messaging Opt-In Consent

_Last updated: 2026-04-23_

This page documents the opt-in consent for the Wormhole phone messaging module (SMS and, in the future, voice).

## Identity of Operator and recipient

The Operator of this Wormhole instance and the sole recipient of any SMS or voice messages it sends are the same person: Zach Nguyen (`hi@zachnguyen.com`).

## Nature of consent

As sole Operator and sole recipient, Zach Nguyen has explicitly consented to:

- Receive SMS and voice messages from the Wormhole phone module
- Send SMS and voice messages to the Wormhole phone module for processing

This consent was captured on **2026-04-23**, by configuring the Wormhole software with:

1. A single allowlisted recipient phone number, stored in the `PHONE_ALLOWED_FROM` environment variable
2. Explicit Twilio and Telnyx credentials tied to the Operator's own accounts
3. A messaging profile narrowly scoped to notify the Operator of system events

## Scope of messaging

The Wormhole phone module sends:

- Status updates on long-running engineering tasks
- Questions requiring the Operator's input on design decisions
- Notifications when tasks are complete, blocked, or rate-limited

The module is hardcoded to reject all inbound traffic from any number other than the allowlisted recipient. Messages cannot be forwarded to third parties; there is no broadcast or group messaging capability.

## How to revoke consent

The Operator may revoke consent and stop all messaging at any time by:

- Replying `STOP` to any outbound message (honored by the underlying carrier)
- Removing the `PHONE_ALLOWED_FROM` environment variable
- Releasing the Twilio or Telnyx phone number

## Contact

Revocation requests, questions, or corrections: hi@zachnguyen.com

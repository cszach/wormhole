---
layout: ../layouts/DocsLayout.astro
title: Privacy Policy
---

# Privacy Policy

_Last updated: 2026-04-23_

Wormhole is a self-hosted, open-source personal terminal assistant operated by a single individual (the "Operator"). This privacy policy describes how Wormhole, including its phone messaging module, handles personal data.

## Who this policy covers

This policy applies to a single Operator: the person running Wormhole on their own server. The Operator is also the sole recipient of any SMS or voice communications the system sends or receives in this deployment.

## What data is processed

- SMS and voice messages exchanged between the Operator and the Wormhole instance they run
- Phone numbers of the sender and recipient (both owned or controlled by the Operator)
- Derived session state, scratchpad notes, and transcript history stored locally on the Operator's own machine

## Where data is stored

All data is stored on the Operator's own infrastructure. Wormhole does not host, back up, or transmit user data to any Wormhole-owned service. Data leaves the Operator's machine only when strictly necessary to complete an action, for example when an SMS is relayed to the carrier for delivery.

## Third parties

When configured, data necessary for the requested action is sent to:

- **Twilio** or **Telnyx** — for SMS and voice message delivery (message body, sender and recipient phone numbers)
- **Anthropic** — for Claude large-language-model inference used by the phone agent (message body, conversation context)

Each third party operates under its own privacy policy.

## Retention and deletion

All data is stored on the Operator's own filesystem and can be deleted by the Operator at any time. Wormhole provides no cloud-hosted data that the Operator cannot directly access.

## Contact

Questions about this policy: hi@zachnguyen.com

import fs from "node:fs";
import path from "node:path";

import type {
	InboundSms,
	OutboundSmsResult,
	SmsProvider,
	VerifyResult,
	WebhookInput
} from "./index.js";

export type FakeProviderOpts = {
	logFile: string;
};

type FakePayload = {
	from?: unknown;
	to?: unknown;
	body?: unknown;
	sid?: unknown;
};

export function createFakeSmsProvider(opts: FakeProviderOpts): SmsProvider {
	fs.mkdirSync(path.dirname(opts.logFile), { recursive: true });
	let outCounter = 0;

	return {
		kind: "fake",

		async sendSms(to, body): Promise<OutboundSmsResult> {
			outCounter += 1;
			const sid = `FAKE-OUT-${Date.now()}-${outCounter}`;
			const line =
				JSON.stringify({
					ts: new Date().toISOString(),
					sid,
					to,
					body
				}) + "\n";
			await fs.promises.appendFile(opts.logFile, line);
			return { sid, segments: 1 };
		},

		async verifyAndParse({ parsedBody }): Promise<VerifyResult> {
			if (parsedBody === null || typeof parsedBody !== "object") {
				return { valid: false, reason: "body is not a JSON object" };
			}

			const p = parsedBody as FakePayload;
			const from = typeof p.from === "string" ? p.from : null;
			const to = typeof p.to === "string" ? p.to : null;
			const body = typeof p.body === "string" ? p.body : null;

			if (from === null || to === null || body === null) {
				return {
					valid: false,
					reason: "missing 'from', 'to', or 'body' field"
				};
			}

			const sid =
				typeof p.sid === "string"
					? p.sid
					: `FAKE-IN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

			const inbound: InboundSms = {
				sid,
				from,
				to,
				body,
				receivedAt: Date.now()
			};

			return { valid: true, inbound };
		}
	};
}

export function isFakeWebhookInput(input: WebhookInput): boolean {
	return typeof input.parsedBody === "object" && input.parsedBody !== null;
}

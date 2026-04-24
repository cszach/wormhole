import twilioSdk from "twilio";

import type {
	InboundSms,
	OutboundSmsResult,
	SmsProvider,
	VerifyResult
} from "./index.js";

export type TwilioProviderOpts = {
	accountSid: string;
	authToken: string;
	fromNumber: string;
	publicWebhookUrl: string | null;
};

type TwilioFormPayload = {
	MessageSid?: string;
	SmsMessageSid?: string;
	From?: string;
	To?: string;
	Body?: string;
};

export function createTwilioSmsProvider(opts: TwilioProviderOpts): SmsProvider {
	const client = twilioSdk(opts.accountSid, opts.authToken);

	return {
		kind: "twilio",

		async sendSms(to, body): Promise<OutboundSmsResult> {
			const res = await client.messages.create({
				from: opts.fromNumber,
				to,
				body
			});
			const segments =
				typeof res.numSegments === "string" ? Number(res.numSegments) || 1 : 1;
			return { sid: res.sid, segments };
		},

		async verifyAndParse({ parsedBody, headers }): Promise<VerifyResult> {
			const sigHeader = pickHeader(headers, "x-twilio-signature");
			if (sigHeader === null) {
				return {
					valid: false,
					reason: "missing x-twilio-signature header"
				};
			}

			if (parsedBody === null || typeof parsedBody !== "object") {
				return { valid: false, reason: "body is not a form object" };
			}

			const form = parsedBody as TwilioFormPayload & Record<string, unknown>;

			// Production: validate HMAC over the exact URL Twilio POSTed.
			// Dev (PHONE_DEV_MODE=1): skip so curl-based smoke tests work.
			// Constructor refuses to build without publicWebhookUrl when not in dev.
			if (opts.publicWebhookUrl !== null) {
				const ok = twilioSdk.validateRequest(
					opts.authToken,
					sigHeader,
					opts.publicWebhookUrl,
					form
				);
				if (!ok) {
					return {
						valid: false,
						reason: "twilio signature validation failed"
					};
				}
			}

			const sid =
				typeof form.MessageSid === "string"
					? form.MessageSid
					: typeof form.SmsMessageSid === "string"
						? form.SmsMessageSid
						: null;
			const from = typeof form.From === "string" ? form.From : null;
			const to = typeof form.To === "string" ? form.To : null;
			const body = typeof form.Body === "string" ? form.Body : null;

			if (sid === null || from === null || to === null || body === null) {
				return {
					valid: false,
					reason: "missing MessageSid, From, To, or Body"
				};
			}

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

function pickHeader(
	h: Record<string, string | string[] | undefined>,
	name: string
): string | null {
	const v = h[name.toLowerCase()];
	if (v === undefined) {
		return null;
	}
	return Array.isArray(v) ? (v[0] ?? null) : v;
}

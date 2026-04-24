import Telnyx, { TelnyxWebhook } from "telnyx";

import type {
	InboundSms,
	OutboundSmsResult,
	SmsProvider,
	VerifyResult
} from "./index.js";

export type TelnyxProviderOpts = {
	apiKey: string;
	publicKey: string;
	fromNumber: string;
};

type TelnyxInboundPayload = {
	id?: string;
	from?: { phone_number?: string } | string;
	to?: Array<{ phone_number?: string }> | string;
	text?: string;
	parts?: number;
};

type TelnyxEventEnvelope = {
	data?: {
		id?: string;
		event_type?: string;
		payload?: TelnyxInboundPayload;
	};
};

export function createTelnyxSmsProvider(opts: TelnyxProviderOpts): SmsProvider {
	const client = new Telnyx({
		apiKey: opts.apiKey,
		publicKey: opts.publicKey
	});
	const verifier = new TelnyxWebhook(opts.publicKey);

	return {
		kind: "telnyx",

		async sendSms(to, body): Promise<OutboundSmsResult> {
			const res = await client.messages.send({
				from: opts.fromNumber,
				to,
				text: body
			});
			const data = res.data as { id?: string; parts?: number } | undefined;
			return {
				sid: data?.id ?? "",
				segments: data?.parts ?? 1
			};
		},

		async verifyAndParse({
			rawBody,
			parsedBody,
			headers
		}): Promise<VerifyResult> {
			const headerRecord: Record<string, string> = {};
			for (const [k, v] of Object.entries(headers)) {
				if (typeof v === "string") {
					headerRecord[k] = v;
				} else if (Array.isArray(v) && typeof v[0] === "string") {
					headerRecord[k] = v[0];
				}
			}

			try {
				await verifier.verify(rawBody, headerRecord);
			} catch (err) {
				return {
					valid: false,
					reason: `telnyx signature verification failed: ${(err as Error).message}`
				};
			}

			const env = parsedBody as TelnyxEventEnvelope;
			const payload = env.data?.payload;

			if (payload === undefined) {
				return { valid: false, reason: "missing data.payload" };
			}

			if (env.data?.event_type !== "message.received") {
				return {
					valid: false,
					reason: `ignoring event_type=${env.data?.event_type}`
				};
			}

			const from =
				typeof payload.from === "string"
					? payload.from
					: (payload.from?.phone_number ?? null);
			const to = Array.isArray(payload.to)
				? (payload.to[0]?.phone_number ?? null)
				: typeof payload.to === "string"
					? payload.to
					: null;
			const body = typeof payload.text === "string" ? payload.text : null;
			const sid = payload.id ?? env.data?.id ?? null;

			if (from === null || to === null || body === null || sid === null) {
				return {
					valid: false,
					reason: "missing from, to, text, or id in payload"
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

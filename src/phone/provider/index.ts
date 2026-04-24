export type InboundSms = {
	sid: string;
	from: string;
	to: string;
	body: string;
	receivedAt: number;
};

export type OutboundSmsResult = {
	sid: string;
	segments: number;
};

export type WebhookInput = {
	rawBody: string;
	parsedBody: unknown;
	headers: Record<string, string | string[] | undefined>;
};

export type VerifyResult =
	| { valid: true; inbound: InboundSms }
	| { valid: false; reason: string };

export type SmsProvider = {
	kind: string;
	sendSms(to: string, body: string): Promise<OutboundSmsResult>;
	verifyAndParse(input: WebhookInput): Promise<VerifyResult>;
};

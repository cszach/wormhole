import path from "node:path";
import os from "node:os";

export type ProviderKind = "fake" | "telnyx" | "twilio";

export type PhoneConfig = {
	providerKind: ProviderKind;
	fromNumber: string | null;
	allowedFrom: string | null;
	telnyxApiKey: string | null;
	telnyxPublicKey: string | null;
	twilioAccountSid: string | null;
	twilioAuthToken: string | null;
	publicWebhookUrl: string | null;
	devMode: boolean;
	claudeBin: string;
	model: string;
	stateDir: string;
	stateFile: string;
	scratchpadFile: string;
	fakeLogFile: string;
	agentCwd: string;
	maxTurnMs: number;
};

export function loadPhoneConfig(): PhoneConfig {
	const home = os.homedir();
	const stateDir = path.join(home, ".wormhole");

	return {
		providerKind:
			(process.env.PHONE_PROVIDER as ProviderKind | undefined) ?? "fake",
		fromNumber:
			process.env.PHONE_FROM_NUMBER ?? process.env.TELNYX_FROM_NUMBER ?? null,
		allowedFrom: process.env.PHONE_ALLOWED_FROM ?? null,
		telnyxApiKey: process.env.TELNYX_API_KEY ?? null,
		telnyxPublicKey: process.env.TELNYX_PUBLIC_KEY ?? null,
		twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
		twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
		publicWebhookUrl: process.env.PHONE_PUBLIC_WEBHOOK_URL ?? null,
		devMode: (process.env.PHONE_DEV_MODE ?? "") === "1",
		claudeBin: process.env.PHONE_CLAUDE_BIN ?? "claude",
		model: process.env.PHONE_AGENT_MODEL ?? "sonnet",
		stateDir,
		stateFile: path.join(stateDir, "phone-state.json"),
		scratchpadFile: path.join(stateDir, "phone-scratchpad.md"),
		fakeLogFile: path.join(stateDir, "phone-fake-sms.log"),
		agentCwd: process.env.PHONE_AGENT_CWD ?? process.cwd(),
		maxTurnMs: Number(process.env.PHONE_MAX_TURN_SECONDS ?? 3600) * 1000
	};
}

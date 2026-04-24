import type { Express } from "express";

import { PhoneAgent } from "./agent.js";
import { loadPhoneConfig, type PhoneConfig } from "./config.js";
import { startPhoneMcpHttpServer } from "./mcp-server.js";
import { createFakeSmsProvider } from "./provider/fake.js";
import type { SmsProvider } from "./provider/index.js";
import { createTelnyxSmsProvider } from "./provider/telnyx.js";
import { createTwilioSmsProvider } from "./provider/twilio.js";
import { mountPhoneRoutes } from "./routes.js";

export type InitPhoneAgentOpts = {
	app: Express;
	log?: Pick<Console, "log" | "warn" | "error">;
	config?: PhoneConfig;
};

export type InitPhoneAgentResult = {
	enabled: boolean;
	reason: string;
	provider?: SmsProvider;
	agent?: PhoneAgent;
};

export async function initPhoneAgent(
	opts: InitPhoneAgentOpts
): Promise<InitPhoneAgentResult> {
	const log = opts.log ?? console;
	const config = opts.config ?? loadPhoneConfig();

	if (config.providerKind === "fake" && !config.devMode) {
		const reason =
			"PHONE_PROVIDER=fake refuses to mount webhook publicly; set PHONE_DEV_MODE=1 for local dev";
		log.warn(`[phone-agent] ${reason}`);
		return { enabled: false, reason };
	}

	if (config.allowedFrom === null && !config.devMode) {
		const reason = "PHONE_ALLOWED_FROM required unless PHONE_DEV_MODE=1";
		log.warn(`[phone-agent] ${reason}`);
		return { enabled: false, reason };
	}

	const providerResult = buildProvider(config, log);
	if (providerResult.kind === "error") {
		log.warn(`[phone-agent] ${providerResult.reason}`);
		return { enabled: false, reason: providerResult.reason };
	}
	const {provider} = providerResult;

	if (config.allowedFrom === null) {
		log.warn(
			"[phone-agent] PHONE_ALLOWED_FROM not set and PHONE_DEV_MODE=1 — accepting any from-number"
		);
	}

	const toNumber = config.allowedFrom ?? "+10000000000";

	// Create a placeholder inbox-bound agent wiring; we need the Inbox before
	// we can wire MCP tools, so build the agent first and reuse its inbox.
	const agent = new PhoneAgent({
		provider,
		toNumber,
		agentCwd: config.agentCwd,
		stateFile: config.stateFile,
		scratchpadFile: config.scratchpadFile,
		maxTurnMs: config.maxTurnMs,
		claudeBin: config.claudeBin,
		mcpUrl: "", // filled in after MCP server boots
		model: config.model,
		log
	});

	const mcp = await startPhoneMcpHttpServer(
		{
			provider,
			inbox: agent.inbox,
			toNumber,
			scratchpadFile: config.scratchpadFile
		},
		log
	);

	// Patch mcpUrl now that MCP is up. This is deliberately late-bound so the
	// agent and MCP can share the same Inbox instance.
	(agent as unknown as { opts: { mcpUrl: string } }).opts.mcpUrl = mcp.url;

	mountPhoneRoutes(opts.app, {
		provider,
		agent,
		allowedFrom: config.allowedFrom,
		log
	});

	log.log(
		`[phone-agent] ready — provider=${provider.kind} cwd=${config.agentCwd} model=${config.model}`
	);

	return { enabled: true, reason: "ok", provider, agent };
}

type ProviderBuildResult =
	| { kind: "ok"; provider: SmsProvider }
	| { kind: "error"; reason: string };

function buildProvider(
	config: PhoneConfig,
	log: Pick<Console, "log" | "warn" | "error">
): ProviderBuildResult {
	switch (config.providerKind) {
		case "fake": {
			log.log(`[phone-agent] fake SMS log: ${config.fakeLogFile}`);
			return {
				kind: "ok",
				provider: createFakeSmsProvider({
					logFile: config.fakeLogFile
				})
			};
		}

		case "telnyx": {
			if (
				config.telnyxApiKey === null ||
				config.telnyxPublicKey === null ||
				config.fromNumber === null
			) {
				return {
					kind: "error",
					reason:
						"telnyx provider selected but TELNYX_API_KEY, TELNYX_PUBLIC_KEY, or TELNYX_FROM_NUMBER missing"
				};
			}
			return {
				kind: "ok",
				provider: createTelnyxSmsProvider({
					apiKey: config.telnyxApiKey,
					publicKey: config.telnyxPublicKey,
					fromNumber: config.fromNumber
				})
			};
		}

		case "twilio": {
			if (
				config.twilioAccountSid === null ||
				config.twilioAuthToken === null ||
				config.fromNumber === null
			) {
				return {
					kind: "error",
					reason:
						"twilio provider selected but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or PHONE_FROM_NUMBER missing"
				};
			}
			if (config.publicWebhookUrl === null && !config.devMode) {
				return {
					kind: "error",
					reason:
						"twilio provider requires PHONE_PUBLIC_WEBHOOK_URL (or PHONE_DEV_MODE=1 for local dev)"
				};
			}
			return {
				kind: "ok",
				provider: createTwilioSmsProvider({
					accountSid: config.twilioAccountSid,
					authToken: config.twilioAuthToken,
					fromNumber: config.fromNumber,
					publicWebhookUrl: config.publicWebhookUrl
				})
			};
		}

		default: {
			return {
				kind: "error",
				reason: `unknown provider kind: ${String(config.providerKind)}`
			};
		}
	}
}

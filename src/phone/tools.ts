import fs from "node:fs";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { splitForSms } from "./format.js";
import type { Inbox } from "./inbox.js";
import type { SmsProvider } from "./provider/index.js";

export const PHONE_MCP_SERVER_NAME = "wormhole-phone-tools";

export type PhoneToolOpts = {
	provider: SmsProvider;
	inbox: Inbox;
	toNumber: string;
	scratchpadFile: string;
};

export function createPhoneMcpServer(opts: PhoneToolOpts): McpServer {
	const server = new McpServer({
		name: PHONE_MCP_SERVER_NAME,
		version: "1.0.0"
	});

	server.registerTool(
		"send_sms_to_user",
		{
			description:
				"Send an SMS to the user. Use this for ALL communication: progress updates, questions, blockers, final summaries. Plain text only — no markdown, no code fences. Long bodies are auto-segmented.",
			inputSchema: {
				body: z
					.string()
					.min(1)
					.describe("The SMS body. Plain text. Max ~1400 chars per segment.")
			}
		},
		async ({ body }) => {
			const segments = splitForSms(body);

			if (segments.length === 0) {
				return {
					content: [{ type: "text", text: "Nothing to send (empty body)." }]
				};
			}

			const sids: string[] = [];
			for (const seg of segments) {
				const res = await opts.provider.sendSms(opts.toNumber, seg);
				sids.push(res.sid);
			}

			return {
				content: [
					{
						type: "text",
						text: `SMS sent in ${segments.length} segment(s). sids: ${sids.join(", ")}`
					}
				]
			};
		}
	);

	server.registerTool(
		"check_inbox",
		{
			description:
				"Drain pending inbound SMS from the user. Call this between major steps of a long task to catch redirections or new instructions. Returns empty array if none.",
			inputSchema: {}
		},
		async () => {
			const items = opts.inbox.drain();

			if (items.length === 0) {
				return { content: [{ type: "text", text: "[]" }] };
			}

			const lines = items.map(
				(m) => `[${new Date(m.receivedAt).toISOString()}] ${m.body}`
			);
			return { content: [{ type: "text", text: lines.join("\n") }] };
		}
	);

	server.registerTool(
		"request_call_back",
		{
			description:
				"(v2 stub) Request a voice call back to the user. In v1, this sends an SMS noting the request — voice calling is not yet implemented.",
			inputSchema: {
				reason: z.string().min(1).describe("Why you want to call the user.")
			}
		},
		async ({ reason }) => {
			const msg = `[callback requested] ${reason}`;
			await opts.provider.sendSms(opts.toNumber, msg);
			return {
				content: [
					{
						type: "text",
						text: "Call-back request delivered as SMS (voice not yet wired)."
					}
				]
			};
		}
	);

	server.registerTool(
		"note_scratchpad",
		{
			description:
				"Append a timestamped note to your persistent scratchpad file. Useful for remembering decisions, facts, or context across SMS sessions.",
			inputSchema: {
				entry: z.string().min(1).describe("The note to append.")
			}
		},
		async ({ entry }) => {
			fs.mkdirSync(path.dirname(opts.scratchpadFile), {
				recursive: true
			});
			const line = `\n## ${new Date().toISOString()}\n${entry}\n`;
			await fs.promises.appendFile(opts.scratchpadFile, line, {
				mode: 0o600
			});
			// Ensure mode is applied even if the file already existed with loose perms.
			try {
				await fs.promises.chmod(opts.scratchpadFile, 0o600);
			} catch {
				// best-effort
			}
			return { content: [{ type: "text", text: "Noted." }] };
		}
	);

	return server;
}

export function phoneToolNames(): string[] {
	const prefix = `mcp__${PHONE_MCP_SERVER_NAME}__`;
	return [
		`${prefix}send_sms_to_user`,
		`${prefix}check_inbox`,
		`${prefix}request_call_back`,
		`${prefix}note_scratchpad`
	];
}

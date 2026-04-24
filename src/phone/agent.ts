import { spawn } from "node:child_process";
import readline from "node:readline";

import { Inbox } from "./inbox.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import type { InboundSms, SmsProvider } from "./provider/index.js";
import { PhoneStateStore } from "./state.js";
import { PHONE_MCP_SERVER_NAME, phoneToolNames } from "./tools.js";

const BUILTIN_TOOLS = ["Read", "Glob", "Grep", "Bash", "Edit", "Write"];

// Best-effort deny list for sensitive paths. Not a sandbox — Bash can still bypass
// with creative shell constructs — but catches obvious read/write/edit attempts.
const DENY_RULES = [
	"Read(~/.ssh/**)",
	"Read(~/.aws/**)",
	"Read(~/.claude/**)",
	"Read(~/.wormhole/**)",
	"Read(/etc/shadow)",
	"Read(**/.env*)",
	"Read(**/*.pem)",
	"Read(**/*.key)",
	"Read(**/id_rsa*)",
	"Read(**/id_ed25519*)",
	"Edit(~/.ssh/**)",
	"Edit(~/.aws/**)",
	"Edit(~/.claude/**)",
	"Edit(~/.wormhole/**)",
	"Edit(**/.env*)",
	"Write(~/.ssh/**)",
	"Write(~/.aws/**)",
	"Write(~/.claude/**)",
	"Write(~/.wormhole/**)",
	"Bash(cat ~/.ssh/*)",
	"Bash(cat ~/.ssh/**)",
	"Bash(cat ~/.aws/*)",
	"Bash(cat ~/.wormhole/*)",
	"Bash(cat **/.env*)",
	"Bash(cat /etc/shadow)"
];

export type PhoneAgentOpts = {
	provider: SmsProvider;
	toNumber: string;
	agentCwd: string;
	stateFile: string;
	scratchpadFile: string;
	maxTurnMs: number;
	claudeBin: string;
	mcpUrl: string;
	model: string;
	log: Pick<Console, "log" | "warn" | "error">;
};

export class PhoneAgent {
	readonly inbox = new Inbox();
	private readonly state: PhoneStateStore;
	private running = false;
	private turnCounter = 0;

	constructor(private readonly opts: PhoneAgentOpts) {
		this.state = new PhoneStateStore(opts.stateFile);
	}

	enqueue(msg: InboundSms): void {
		const added = this.inbox.enqueue(msg);
		if (!added) {
			this.opts.log.log(`[phone-agent] duplicate sid=${msg.sid}, dropped`);
			return;
		}

		this.state.update({ lastInboundAt: msg.receivedAt });

		if (!this.running) {
			void this.runLoop();
		}
	}

	private async runLoop(): Promise<void> {
		if (this.running) {
			return;
		}

		this.running = true;

		try {
			while (this.inbox.size() > 0) {
				await this.runTurn();
			}
		} finally {
			this.running = false;
			this.state.flushNow();
		}
	}

	private async runTurn(): Promise<void> {
		const drained = this.inbox.drain();

		if (drained.length === 0) {
			return;
		}

		this.turnCounter += 1;
		const turnN = this.turnCounter;
		const combined = drained.map((m) => m.body).join("\n\n---\n\n");
		const priorSession = this.state.get().agentSessionId;

		this.opts.log.log(
			`[phone-agent] turn #${turnN} start, msgs=${drained.length}, resume=${priorSession ?? "none"}`
		);

		try {
			const sessionId = await this.spawnClaude({
				prompt: combined,
				resume: priorSession
			});

			if (sessionId !== null) {
				this.state.update({ agentSessionId: sessionId });
			}

			this.opts.log.log(`[phone-agent] turn #${turnN} done`);
		} catch (err) {
			this.opts.log.error(`[phone-agent] turn #${turnN} error:`, err);
			try {
				await this.opts.provider.sendSms(
					this.opts.toNumber,
					`agent error: ${(err as Error).message}`
				);
			} catch {
				// best effort
			}
		}
	}

	private async spawnClaude(args: {
		prompt: string;
		resume: string | null;
	}): Promise<string | null> {
		const mcpConfig = JSON.stringify({
			mcpServers: {
				[PHONE_MCP_SERVER_NAME]: {
					type: "http",
					url: this.opts.mcpUrl
				}
			}
		});

		const allowedTools = [...BUILTIN_TOOLS, ...phoneToolNames()].join(",");
		const settingsJson = JSON.stringify({
			permissions: { deny: DENY_RULES }
		});

		const cliArgs = [
			"-p",
			"--mcp-config",
			mcpConfig,
			"--strict-mcp-config",
			"--append-system-prompt",
			SYSTEM_PROMPT,
			"--permission-mode",
			"bypassPermissions",
			"--output-format",
			"stream-json",
			"--verbose",
			"--allowedTools",
			allowedTools,
			"--settings",
			settingsJson,
			"--model",
			this.opts.model
		];

		if (args.resume !== null) {
			cliArgs.push("--resume", args.resume);
		}

		// Do NOT pass ANTHROPIC_API_KEY so the CLI uses the user's subscription
		// auth from `claude login`.
		const childEnv: NodeJS.ProcessEnv = { ...process.env };
		delete childEnv.ANTHROPIC_API_KEY;

		this.opts.log.log(
			`[phone-agent] spawning ${this.opts.claudeBin} ${cliArgs
				.filter((a) => !a.startsWith("{") && !a.startsWith("You are"))
				.join(" ")}`
		);

		const child = spawn(this.opts.claudeBin, cliArgs, {
			cwd: this.opts.agentCwd,
			env: childEnv,
			stdio: ["pipe", "pipe", "pipe"]
		});

		// Prompt goes over stdin to avoid argv size limits and quoting pain.
		child.stdin.write(args.prompt);
		child.stdin.end();

		const deadline = Date.now() + this.opts.maxTurnMs;
		let killed = false;
		const killTimer = setTimeout(() => {
			killed = true;
			this.opts.log.warn(
				`[phone-agent] turn exceeded maxTurnMs=${this.opts.maxTurnMs}, killing subprocess`
			);
			child.kill("SIGTERM");
		}, this.opts.maxTurnMs);

		const stderrBuf: string[] = [];
		child.stderr.on("data", (chunk: Buffer) => {
			stderrBuf.push(chunk.toString("utf8"));
		});

		const stdoutLines = readline.createInterface({
			input: child.stdout,
			crlfDelay: Infinity
		});

		let sessionId: string | null = null;

		for await (const line of stdoutLines) {
			if (Date.now() > deadline) {
				break;
			}

			const trimmed = line.trim();
			if (trimmed.length === 0) {
				continue;
			}

			let parsed: unknown;
			try {
				parsed = JSON.parse(trimmed);
			} catch {
				this.opts.log.warn(
					`[phone-agent] non-JSON stdout line: ${trimmed.slice(0, 200)}`
				);
				continue;
			}

			const extractedId = extractSessionId(parsed);
			if (extractedId !== null) {
				sessionId = extractedId;
			}

			const summary = summarizeStreamLine(parsed);
			if (summary !== null) {
				this.opts.log.log(`[phone-agent] stream: ${summary}`);
			}
		}

		clearTimeout(killTimer);

		const exitCode: number | null = await new Promise((resolve) => {
			if (child.exitCode !== null) {
				resolve(child.exitCode);
				return;
			}
			child.once("exit", (code) => {
				resolve(code);
			});
		});

		if (killed) {
			throw new Error(`turn killed: exceeded ${this.opts.maxTurnMs}ms`);
		}

		if (exitCode !== 0) {
			const stderr = stderrBuf.join("").slice(-2000);
			throw new Error(
				`claude exited with code ${exitCode}${stderr.length > 0 ? `; stderr: ${stderr}` : ""}`
			);
		}

		return sessionId;
	}
}

function extractSessionId(msg: unknown): string | null {
	if (typeof msg !== "object" || msg === null) {
		return null;
	}

	const record = msg as Record<string, unknown>;
	if (record.type !== "system") {
		return null;
	}

	const sid = record.session_id;
	return typeof sid === "string" ? sid : null;
}

function summarizeStreamLine(msg: unknown): string | null {
	if (typeof msg !== "object" || msg === null) {
		return null;
	}

	const record = msg as Record<string, unknown>;
	const {type} = record;

	if (type === "system") {
		const {subtype} = record;
		return `system ${typeof subtype === "string" ? subtype : "?"}`;
	}

	if (type === "assistant") {
		const message = record.message as { content?: unknown } | undefined;
		const content = message?.content;
		if (Array.isArray(content)) {
			const parts = content.map((c) => {
				const cr = c as Record<string, unknown>;
				if (cr.type === "text") {
					const t = typeof cr.text === "string" ? cr.text : "";
					return `text("${t.slice(0, 80)}${t.length > 80 ? "..." : ""}")`;
				}
				if (cr.type === "tool_use") {
					return `tool_use(${String(cr.name)})`;
				}
				return String(cr.type);
			});
			return `assistant ${parts.join(" + ")}`;
		}
		return "assistant";
	}

	if (type === "user") {
		return "user (tool_result)";
	}

	if (type === "result") {
		const {subtype} = record;
		const stop =
			typeof subtype === "string" ? subtype : String(record.stop_reason);
		return `result ${stop}`;
	}

	return `${String(type)}`;
}

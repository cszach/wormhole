import "dotenv/config";
import { createServer } from "node:http";
import { createServer as createHTTPSServer } from "node:https";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";

import type { ServerMessage } from "./types.js";
import { isValidSessionName } from "./validation.js";
import {
	sendKeys,
	sendRawKey,
	resizePane,
	capturePane,
	listSessions,
	createSession,
	killSession,
	setBuffer,
	pasteBuffer,
	deleteBuffer
} from "./tmux.js";

const PORT = Number(process.env.PORT ?? 5173);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const TLS_CERT = process.env.TLS_CERT ?? "";
const TLS_KEY = process.env.TLS_KEY ?? "";
const VAULT_FILE = path.resolve(
	process.env.VAULT_FILE ?? ".wormhole-vault.enc"
);

const uploadDir = path.resolve(UPLOAD_DIR);

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => {
			cb(null, uploadDir);
		},
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname);
			cb(null, `${Date.now()}${ext}`);
		}
	})
});

const app = express();
app.use(express.json());

const useTLS = TLS_CERT && TLS_KEY;

const server = useTLS
	? createHTTPSServer(
			{
				cert: fs.readFileSync(TLS_CERT),
				key: fs.readFileSync(TLS_KEY)
			},
			app
		)
	: createServer(app);

const wss = new WebSocketServer({ server });

app.use(express.static(path.resolve("public")));

app.get("/app", (_req, res) => {
	res.sendFile(path.resolve("public/app.html"));
});

app.post("/api/upload", upload.single("image"), (req, res) => {
	if (!req.file) {
		res.status(400).json({ error: "No file uploaded" });

		return;
	}

	const filePath = path.resolve(req.file.path);
	res.json({ path: filePath });
});

app.get("/api/sessions", async (_req, res) => {
	const sessions = await listSessions();
	res.json({ sessions });
});

app.post("/api/sessions", async (req, res) => {
	const { name } = req.body;
	const error = isValidSessionName(name);

	if (error) {
		res.status(400).json({ error });

		return;
	}

	const sessions = await listSessions();

	if (sessions.includes(name)) {
		res.status(409).json({ error: "Session already exists" });

		return;
	}

	try {
		await createSession(name);
		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to create session" });
	}
});

app.delete("/api/sessions/:name", async (req, res) => {
	const { name } = req.params;
	const sessions = await listSessions();

	if (sessions.length <= 1) {
		res.status(400).json({ error: "Cannot delete the last session" });

		return;
	}

	if (!sessions.includes(name)) {
		res.status(404).json({ error: "Session not found" });

		return;
	}

	try {
		await killSession(name);
		bgState.delete(name);

		// If we deleted the active session, switch to another one
		if (name === activeSession) {
			const remaining = sessions.filter((session) => session !== name);
			activeSession = remaining[0];
			lastCapture = "";
			stableSent = false;
			broadcast({ type: "session", session: activeSession });
		}

		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to delete session" });
	}
});

const CLIPBOARD_CLEAR_MS = 30000;
let clipboardTimer: ReturnType<typeof setTimeout> | null = null;

function setClipboard(value: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const cmd = os.platform() === "darwin" ? "pbcopy" : "xclip";
		const args = os.platform() === "darwin" ? [] : ["-selection", "clipboard"];
		const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });

		proc.stdin.write(value);
		proc.stdin.end();

		proc.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${cmd} exited with code ${code}`));
			}
		});

		proc.on("error", reject);
	});
}

function clearClipboard(): Promise<void> {
	return setClipboard("");
}

app.get("/api/vault", (_req, res) => {
	if (!fs.existsSync(VAULT_FILE)) {
		res.status(404).json({ error: "No vault" });

		return;
	}

	const data = fs.readFileSync(VAULT_FILE);
	res.set("Content-Type", "application/octet-stream");
	res.send(data);
});

app.put(
	"/api/vault",
	express.raw({ type: "application/octet-stream", limit: "1mb" }),
	(req, res) => {
		fs.writeFileSync(VAULT_FILE, req.body as Buffer);
		res.status(204).end();
	}
);

app.delete("/api/vault", (_req, res) => {
	if (fs.existsSync(VAULT_FILE)) {
		fs.unlinkSync(VAULT_FILE);
	}

	res.status(204).end();
});

type SessionState = {
	lastCapture: string;
	lastChangeMs: number;
	stableSent: boolean;
	hasChanged: boolean;
};

let activeSession = "";
let lastCapture = "";
let lastChangeMs = Date.now();
let stableSent = false;
const bgState = new Map<string, SessionState>();

const STABLE_THRESHOLD_MS = 2000;
const POLL_INTERVAL_MS = 250;
const HEARTBEAT_INTERVAL_MS = 15000;
const BG_POLL_INTERVAL_MS = 2000;

function broadcast(message: ServerMessage): void {
	const data = JSON.stringify(message);

	for (const client of wss.clients) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	}
}

async function pollTmux(): Promise<void> {
	try {
		if (!activeSession) {
			const sessions = await listSessions();

			if (sessions.length > 0) {
				activeSession = sessions[0];
				broadcast({ type: "session", session: activeSession });
			} else {
				return;
			}
		}

		const content = await capturePane(activeSession);

		if (content !== lastCapture) {
			lastCapture = content;
			lastChangeMs = Date.now();
			stableSent = false;
			broadcast({ type: "output", content });
		} else if (
			!stableSent &&
			Date.now() - lastChangeMs >= STABLE_THRESHOLD_MS
		) {
			stableSent = true;
			broadcast({ type: "stable" });
		}
	} catch {
		// tmux session may not exist yet; silently retry
	}
}

setInterval(() => {
	pollTmux();
}, POLL_INTERVAL_MS);

async function pollBackgroundSessions(): Promise<void> {
	if (!activeSession) {
		return;
	}

	try {
		const sessions = await listSessions();

		for (const name of sessions) {
			if (name === activeSession) {
				continue;
			}

			const content = await capturePane(name);
			const isBlank = content.trim().length === 0;
			const state = bgState.get(name);

			if (!state) {
				bgState.set(name, {
					lastCapture: content,
					lastChangeMs: Date.now(),
					stableSent: false,
					hasChanged: false
				});
			} else if (content !== state.lastCapture) {
				state.lastCapture = content;
				state.lastChangeMs = Date.now();
				state.stableSent = false;
				state.hasChanged = true;
			} else if (
				!state.stableSent &&
				state.hasChanged &&
				!isBlank &&
				Date.now() - state.lastChangeMs >= STABLE_THRESHOLD_MS
			) {
				state.stableSent = true;
				broadcast({ type: "bg-stable", session: name });
			}
		}
	} catch {
		// Ignore errors from background polling
	}
}

setInterval(() => {
	pollBackgroundSessions();
}, BG_POLL_INTERVAL_MS);

// Heartbeat: ping all clients, terminate unresponsive ones
setInterval(() => {
	for (const client of wss.clients) {
		const ws = client as WebSocket & { isAlive?: boolean };

		if (ws.isAlive === false) {
			ws.terminate();

			continue;
		}

		ws.isAlive = false;
		ws.ping();
	}
}, HEARTBEAT_INTERVAL_MS);

wss.on("connection", (ws) => {
	const sock = ws as WebSocket & { isAlive?: boolean };
	sock.isAlive = true;

	ws.on("pong", () => {
		sock.isAlive = true;
	});

	// Send current session name and output on connect
	ws.send(JSON.stringify({ type: "session", session: activeSession }));

	if (lastCapture) {
		ws.send(JSON.stringify({ type: "output", content: lastCapture }));
	}

	// Send current stable background sessions
	for (const [name, state] of bgState) {
		if (state.stableSent) {
			ws.send(JSON.stringify({ type: "bg-stable", session: name }));
		}
	}

	ws.on("message", async (raw) => {
		try {
			const message = JSON.parse(String(raw));

			if (message.type === "send") {
				const images = (message.imagePaths ?? [])
					.map((p: string) => ` [Image: ${p}]`)
					.join("");

				await sendKeys(activeSession, message.text + images);
			}

			if (message.type === "key" && message.key) {
				await sendRawKey(activeSession, message.key);
			}

			if (message.type === "resize" && message.cols) {
				await resizePane(activeSession, message.cols);
			}

			if (message.type === "ping" && message.ts) {
				ws.send(JSON.stringify({ type: "pong", ts: message.ts }));
			}

			if (message.type === "vault-inject" && message.value) {
				try {
					await setBuffer(message.value);

					try {
						await pasteBuffer(activeSession);
					} finally {
						await deleteBuffer();
					}

					ws.send(JSON.stringify({ type: "vault-inject-ack", success: true }));
				} catch {
					ws.send(JSON.stringify({ type: "vault-inject-ack", success: false }));
				}
			}

			if (message.type === "vault-clipboard" && message.value) {
				try {
					if (clipboardTimer) {
						clearTimeout(clipboardTimer);
					}
					await setClipboard(message.value);
					const clearMs = Number(message.clearMs) || CLIPBOARD_CLEAR_MS;
					if (clearMs > 0) {
						clipboardTimer = setTimeout(() => {
							clearClipboard().catch(() => {});
							clipboardTimer = null;
						}, clearMs);
					}
					ws.send(
						JSON.stringify({
							type: "vault-clipboard-ack",
							success: true
						})
					);
				} catch {
					ws.send(
						JSON.stringify({
							type: "vault-clipboard-ack",
							success: false
						})
					);
				}
			}

			if (message.type === "switch" && message.session) {
				// Save current active session state to background map
				if (activeSession) {
					bgState.set(activeSession, {
						lastCapture,
						lastChangeMs,
						stableSent,
						hasChanged: false
					});
				}

				// Restore state from background map if available
				const restored = bgState.get(message.session);

				if (restored) {
					({ lastCapture, lastChangeMs, stableSent } = restored);
					bgState.delete(message.session);
				} else {
					lastCapture = "";
					stableSent = false;
				}

				activeSession = message.session;
				lastChangeMs = Date.now();
				broadcast({ type: "bg-clear", session: activeSession });
				broadcast({ type: "session", session: activeSession });
				pollTmux();
			}
		} catch {
			// Ignore malformed messages
		}
	});
});

const protocol = useTLS ? "https" : "http";

server.listen(PORT, "0.0.0.0", () => {
	console.log(`Wormhole running on ${protocol}://0.0.0.0:${PORT}`);
});

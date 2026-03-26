import "dotenv/config";
import { createServer } from "node:http";
import { createServer as createHTTPSServer } from "node:https";
import path from "node:path";
import fs from "node:fs";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";

import type { ServerMessage } from "./types.js";
import {
	sendKeys,
	sendRawKey,
	resizePane,
	capturePane,
	listSessions,
	createSession,
	killSession
} from "./tmux.js";

const PORT = Number(process.env.PORT ?? 5173);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const TLS_CERT = process.env.TLS_CERT ?? "";
const TLS_KEY = process.env.TLS_KEY ?? "";

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

app.post("/api/upload", upload.single("image"), (req, res) => {
	if (!req.file) {
		res.status(400).json({ error: "No file uploaded" });

		return;
	}

	const filePath = path.resolve(req.file.path);
	res.json({ path: filePath });
});

const SESSION_NAME_RE = /^[^.:]+$/;
const SESSION_MAX_LEN = 20;

function isValidSessionName(name: string): string | null {
	if (!name || name.trim().length === 0) {
		return "Session name cannot be empty";
	}

	if (name.length > SESSION_MAX_LEN) {
		return `Session name must be ${SESSION_MAX_LEN} characters or fewer`;
	}

	if (!SESSION_NAME_RE.test(name)) {
		return "Session name cannot contain . or :";
	}

	return null;
}

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

let activeSession = "";
let lastCapture = "";
let lastChangeMs = Date.now();
let stableSent = false;
const STABLE_THRESHOLD_MS = 2000;
const POLL_INTERVAL_MS = 250;
const HEARTBEAT_INTERVAL_MS = 15000;

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

			if (message.type === "switch" && message.session) {
				activeSession = message.session;
				lastCapture = "";
				stableSent = false;
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

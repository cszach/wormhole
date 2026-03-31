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
	listWindows,
	listSessionsWithWindows,
	createSession,
	killSession,
	renameSession,
	createWindow,
	killWindow,
	renameWindow,
	selectWindow,
	listPanes,
	capturePanePreview,
	selectPane,
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
const FILE_ROOT = path.resolve(process.env.FILE_ROOT ?? ".");

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

app.post("/api/upload", upload.single("file"), (req, res) => {
	if (!req.file) {
		res.status(400).json({ error: "No file uploaded" });

		return;
	}

	const filePath = path.resolve(req.file.path);
	res.json({ path: filePath });
});

app.get("/api/sessions", async (_req, res) => {
	const sessions = await listSessionsWithWindows();
	res.json({ sessions, activeSession, activeWindowIndex });
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
			await syncActiveWindow();
			broadcastSession();
		}

		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to delete session" });
	}
});

app.patch("/api/sessions/:name", async (req, res) => {
	const { name } = req.params;
	const { newName } = req.body;
	const error = isValidSessionName(newName);

	if (error) {
		res.status(400).json({ error });
		return;
	}

	const sessions = await listSessions();

	if (!sessions.includes(name)) {
		res.status(404).json({ error: "Session not found" });
		return;
	}

	if (sessions.includes(newName)) {
		res.status(409).json({ error: "Session name already taken" });
		return;
	}

	try {
		await renameSession(name, newName);

		// Update background state key
		const bg = bgState.get(name);
		if (bg) {
			bgState.delete(name);
			bgState.set(newName, bg);
		}

		if (name === activeSession) {
			activeSession = newName;
			broadcastSession();
		}

		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to rename session" });
	}
});

// --- Window endpoints ---

app.post("/api/sessions/:session/windows", async (req, res) => {
	const { session } = req.params;
	const { name } = req.body ?? {};

	const sessions = await listSessions();

	if (!sessions.includes(session)) {
		res.status(404).json({ error: "Session not found" });
		return;
	}

	try {
		await createWindow(session, name || undefined);
		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to create window" });
	}
});

app.delete("/api/sessions/:session/windows/:index", async (req, res) => {
	const { session } = req.params;
	const index = parseInt(req.params.index, 10);

	const windows = await listWindows(session);

	if (windows.length <= 1) {
		res.status(400).json({ error: "Cannot delete the last window" });
		return;
	}

	if (!windows.some((w) => w.index === index)) {
		res.status(404).json({ error: "Window not found" });
		return;
	}

	try {
		await killWindow(session, index);

		// If we deleted the active window, sync to the session's new active
		if (session === activeSession && index === activeWindowIndex) {
			await syncActiveWindow();
			lastCapture = "";
			stableSent = false;
			broadcastSession();
		}

		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to delete window" });
	}
});

app.patch("/api/sessions/:session/windows/:index", async (req, res) => {
	const { session } = req.params;
	const index = parseInt(req.params.index, 10);
	const { newName } = req.body;

	if (!newName || typeof newName !== "string" || newName.length > 30) {
		res.status(400).json({ error: "Invalid window name" });
		return;
	}

	try {
		await renameWindow(session, index, newName);

		if (session === activeSession && index === activeWindowIndex) {
			activeWindowName = newName;
			broadcastSession();
		}

		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to rename window" });
	}
});

// --- Pane endpoints ---

app.get("/api/sessions/:session/windows/:index/panes", async (req, res) => {
	const { session } = req.params;
	const windowIndex = parseInt(req.params.index, 10);
	const layout = await listPanes(session, windowIndex);

	// Fetch a 1-line preview for each pane
	const panes = await Promise.all(
		layout.panes.map(async (pane) => ({
			...pane,
			preview: await capturePanePreview(session, windowIndex, pane.index)
		}))
	);

	res.json({
		panes,
		windowWidth: layout.windowWidth,
		windowHeight: layout.windowHeight
	});
});

app.get("/api/skills", (_req, res) => {
	const skills: string[] = [];
	const dirs = [
		path.join(os.homedir(), ".claude", "skills"),
		path.resolve(".claude", "skills")
	];

	for (const dir of dirs) {
		if (!fs.existsSync(dir)) {
			continue;
		}

		for (const name of fs.readdirSync(dir)) {
			const file = path.join(dir, name, "SKILL.md");

			if (!fs.existsSync(file)) {
				continue;
			}

			const content = fs.readFileSync(file, "utf-8");
			const match = content.match(/^---\s*\n[\s\S]*?^name:\s*(.+)/m);

			if (match) {
				skills.push(match[1].trim());
			}
		}
	}

	res.json({ skills: [...new Set(skills)] });
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

// --- File browser API ---

const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".ico",
	".bmp",
	".tiff",
	".mp4",
	".webm",
	".avi",
	".mov",
	".mp3",
	".ogg",
	".wav",
	".flac",
	".pdf",
	".zip",
	".tar",
	".gz",
	".bz2",
	".xz",
	".7z",
	".rar",
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".woff",
	".woff2",
	".ttf",
	".otf",
	".eot",
	".sqlite",
	".db"
]);

const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav",
	".pdf": "application/pdf",
	".json": "application/json",
	".xml": "text/xml",
	".html": "text/html",
	".css": "text/css"
};

function isBinaryFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();

	if (BINARY_EXTENSIONS.has(ext)) {
		return true;
	}

	if (MIME_TYPES[ext]) {
		return false;
	}

	// Read first 8KB and check for null bytes
	const fd = fs.openSync(filePath, "r");
	const buf = Buffer.alloc(8192);
	const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
	fs.closeSync(fd);

	for (let i = 0; i < bytesRead; i++) {
		if (buf[i] === 0) {
			return true;
		}
	}

	return false;
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();

	if (MIME_TYPES[ext]) {
		return MIME_TYPES[ext];
	}

	if (isBinaryFile(filePath)) {
		return "application/octet-stream";
	}

	return "text/plain";
}

function resolveFilePath(relativePath: string): string | null {
	if (relativePath.includes("\0")) {
		return null;
	}

	let resolved: string;

	try {
		resolved = path.resolve(FILE_ROOT, relativePath);
	} catch {
		return null;
	}

	if (!fs.existsSync(resolved)) {
		return null;
	}

	let real: string;

	try {
		real = fs.realpathSync(resolved);
	} catch {
		return null;
	}

	const root = fs.realpathSync(FILE_ROOT);

	if (real !== root && !real.startsWith(root + path.sep)) {
		return null;
	}

	return real;
}

app.get("/api/files/list", (req, res) => {
	const dir = String(req.query.dir ?? ".");
	const resolved = resolveFilePath(dir);

	if (!resolved) {
		res.status(403).json({ error: "Access denied" });
		return;
	}

	let stat: fs.Stats;

	try {
		stat = fs.statSync(resolved);
	} catch {
		res.status(404).json({ error: "Not found" });
		return;
	}

	if (!stat.isDirectory()) {
		res.status(400).json({ error: "Not a directory" });
		return;
	}

	const entries = [];

	for (const name of fs.readdirSync(resolved)) {
		try {
			const entryPath = path.join(resolved, name);
			const entryStat = fs.statSync(entryPath);
			entries.push({
				name,
				type: entryStat.isDirectory() ? "directory" : "file",
				size: entryStat.size,
				modified: entryStat.mtime.toISOString()
			});
		} catch {
			// Skip entries we can't stat (broken symlinks, permission errors)
		}
	}

	entries.sort((a, b) => {
		if (a.type !== b.type) {
			return a.type === "directory" ? -1 : 1;
		}
		return a.name.localeCompare(b.name);
	});

	res.json({ entries });
});

const TREE_CAP = 10000;

app.get("/api/files/tree", (req, res) => {
	const ignoreParam = String(req.query.ignore ?? ".git");
	const ignoreSet = new Set(
		ignoreParam
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
	);

	type TreeEntry = {
		path: string;
		type: "file" | "directory";
		size: number;
		modified: string;
	};

	const entries: TreeEntry[] = [];
	let truncated = false;
	const root = fs.realpathSync(FILE_ROOT);

	// Breadth-first walk so root files always appear before deep subtrees
	const queue: { dir: string; rel: string }[] = [{ dir: root, rel: "" }];

	while (queue.length > 0) {
		if (entries.length >= TREE_CAP) {
			truncated = true;
			break;
		}

		const { dir, rel } = queue.shift()!;

		let names: string[];

		try {
			names = fs.readdirSync(dir);
		} catch {
			continue;
		}

		for (const name of names) {
			if (ignoreSet.has(name)) {
				continue;
			}

			if (entries.length >= TREE_CAP) {
				truncated = true;
				break;
			}

			const full = path.join(dir, name);
			const entryRel = rel ? rel + "/" + name : name;

			let stat: fs.Stats;

			try {
				stat = fs.statSync(full);
			} catch {
				continue;
			}

			if (stat.isDirectory()) {
				queue.push({ dir: full, rel: entryRel });
			} else if (stat.isFile()) {
				entries.push({
					path: entryRel,
					type: "file",
					size: stat.size,
					modified: stat.mtime.toISOString()
				});
			}
		}
	}

	entries.sort((a, b) => a.path.localeCompare(b.path));

	res.json({ entries, truncated });
});

app.get("/api/files/read", (req, res) => {
	const filePath = String(req.query.path ?? "");
	const resolved = resolveFilePath(filePath);

	if (!resolved) {
		res.status(403).json({ error: "Access denied" });
		return;
	}

	let stat: fs.Stats;

	try {
		stat = fs.statSync(resolved);
	} catch {
		res.status(404).json({ error: "Not found" });
		return;
	}

	if (!stat.isFile()) {
		res.status(400).json({ error: "Not a file" });
		return;
	}

	const mime = getMimeType(resolved);
	const isText = mime.startsWith("text/") || mime === "application/json";
	res.set("Content-Type", mime + (isText ? "; charset=utf-8" : ""));
	res.set("X-Content-Type-Options", "nosniff");
	fs.createReadStream(resolved).pipe(res);
});

app.get("/api/files/download", (req, res) => {
	const filePath = String(req.query.path ?? "");
	const resolved = resolveFilePath(filePath);

	if (!resolved) {
		res.status(403).json({ error: "Access denied" });
		return;
	}

	let stat: fs.Stats;

	try {
		stat = fs.statSync(resolved);
	} catch {
		res.status(404).json({ error: "Not found" });
		return;
	}

	if (!stat.isFile()) {
		res.status(400).json({ error: "Not a file" });
		return;
	}

	const mime = getMimeType(resolved);
	const basename = path.basename(resolved);
	res.set("Content-Type", mime);
	res.set("Content-Disposition", `attachment; filename="${basename}"`);
	res.set("X-Content-Type-Options", "nosniff");
	fs.createReadStream(resolved).pipe(res);
});

type SessionState = {
	lastCapture: string;
	lastChangeMs: number;
	stableSent: boolean;
	hasChanged: boolean;
};

async function handleVaultInject(value: string): Promise<boolean> {
	try {
		await setBuffer(value);
		try {
			await pasteBuffer(activeTarget());
		} finally {
			await deleteBuffer();
		}
		return true;
	} catch {
		return false;
	}
}

async function handleVaultClipboard(
	value: string,
	clearMs: number
): Promise<boolean> {
	try {
		if (clipboardTimer) {
			clearTimeout(clipboardTimer);
		}
		await setClipboard(value);
		if (clearMs > 0) {
			clipboardTimer = setTimeout(() => {
				clearClipboard().catch(() => {});
				clipboardTimer = null;
			}, clearMs);
		}
		return true;
	} catch {
		return false;
	}
}

let activeSession = "";
let activeWindowIndex = 0;
let activeWindowName = "";
let lastCapture = "";
let lastChangeMs = Date.now();
let stableSent = false;
const bgState = new Map<string, SessionState>();

function activeTarget(): string {
	return `${activeSession}:${activeWindowIndex}`;
}

async function syncActiveWindow(): Promise<void> {
	const windows = await listWindows(activeSession);
	const active = windows.find((w) => w.active);

	if (active) {
		activeWindowIndex = active.index;
		activeWindowName = active.name;
	} else if (windows.length > 0) {
		activeWindowIndex = windows[0].index;
		activeWindowName = windows[0].name;
	}
}

function broadcastSession(): void {
	broadcast({
		type: "session",
		session: activeSession,
		window: activeWindowIndex,
		windowName: activeWindowName
	});
}

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
				await syncActiveWindow();
				broadcastSession();
			} else {
				return;
			}
		}

		let content: string;

		try {
			content = await capturePane(activeTarget());
		} catch {
			// Window may have been deleted externally; re-sync
			try {
				await syncActiveWindow();
				broadcastSession();
				content = await capturePane(activeTarget());
			} catch {
				return;
			}
		}

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
	ws.send(
		JSON.stringify({
			type: "session",
			session: activeSession,
			window: activeWindowIndex,
			windowName: activeWindowName
		})
	);

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
				const files = (message.filePaths ?? [])
					.map((p: string) => ` [File: ${p}]`)
					.join("");

				await sendKeys(activeTarget(), message.text + files);
			}

			if (message.type === "key" && message.key) {
				await sendRawKey(activeTarget(), message.key);
			}

			if (message.type === "resize" && message.cols) {
				await resizePane(activeTarget(), message.cols);
			}

			if (message.type === "ping" && message.ts) {
				ws.send(JSON.stringify({ type: "pong", ts: message.ts }));
			}

			if (message.type === "vault-inject" && message.value) {
				const success = await handleVaultInject(message.value);
				ws.send(JSON.stringify({ type: "vault-inject-ack", success }));
			}

			if (message.type === "vault-clipboard" && message.value) {
				const success = await handleVaultClipboard(
					message.value,
					Number(message.clearMs) || CLIPBOARD_CLEAR_MS
				);
				ws.send(JSON.stringify({ type: "vault-clipboard-ack", success }));
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

				if (typeof message.window === "number") {
					activeWindowIndex = message.window;
					await selectWindow(activeSession, activeWindowIndex);
					const windows = await listWindows(activeSession);
					const win = windows.find((w) => w.index === activeWindowIndex);
					activeWindowName = win?.name ?? "";

					if (typeof message.pane === "number") {
						await selectPane(activeSession, activeWindowIndex, message.pane);
					}
				} else {
					await syncActiveWindow();
				}

				broadcast({ type: "bg-clear", session: activeSession });
				broadcastSession();
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

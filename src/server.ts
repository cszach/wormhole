
import { createServer } from "node:http";
import { createServer as createHTTPSServer } from "node:https";
import path from "node:path";
import fs from "node:fs";

import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";

import type { ServerMessage } from "./types.js";
import { sendKeys, sendRawKey, resizePane, capturePane } from "./tmux.js";

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

let lastCapture = "";
let lastChangeMs = Date.now();
let stableSent = false;
const STABLE_THRESHOLD_MS = 2000;
const POLL_INTERVAL_MS = 500;

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
		const content = await capturePane();

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

wss.on("connection", (ws) => {
	if (lastCapture) {
		ws.send(JSON.stringify({ type: "output", content: lastCapture }));
	}

	ws.on("message", async (raw) => {
		try {
			const message = JSON.parse(String(raw));

			if (message.type === "send") {
				let { text } = message;

				if (message.imagePaths && message.imagePaths.length > 0) {
					for (const p of message.imagePaths) {
						text += ` [Image: ${p}]`;
					}
				}

				await sendKeys(text);
			}

			if (message.type === "key" && message.key) {
				await sendRawKey(message.key);
			}

			if (message.type === "resize" && message.cols) {
				await resizePane(message.cols);
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

import type { ServerMessage } from "@/types.js";

import { state } from "./state.js";
import {
	sessionTop,
	wsDot,
	sessionNameEl,
	output,
	wormholingEl,
	wormholingHint,
	noSessionEl
} from "./dom.js";
import { renderOutput } from "./render.js";
import {
	recordPing,
	sendPing,
	resetPingState,
	PING_INTERVAL_MS
} from "./ping.js";
import { updateVaultWs } from "./vault.js";
import { updateColumns } from "./columns.js";
import { speakLatest } from "./speech.js";
import { updateSessionHint } from "./sessions.js";

const RECONNECT_DELAY_MS = 500;
const WORMHOLING_HINT_MS = 8000;
let wormholingTimer = 0;

export function connect(): void {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	state.ws = new WebSocket(`${protocol}//${location.host}`);

	let pingTimer = 0;

	state.ws.addEventListener("open", () => {
		wsDot.classList.add("connected");
		updateVaultWs(state.ws);
		updateColumns();
		sendPing();
		pingTimer = window.setInterval(sendPing, PING_INTERVAL_MS);
	});

	state.ws.addEventListener("message", (event) => {
		const message: ServerMessage = JSON.parse(event.data);

		if (message.type === "output") {
			state.rawOutput = message.content;
			renderOutput(message.content);
			wormholingEl.hidden = true;
			noSessionEl.hidden = true;
			wormholingHint.classList.remove("visible");
			clearTimeout(wormholingTimer);
		}

		if (message.type === "stable" && state.ttsEnabled) {
			speakLatest();
		}

		if (message.type === "session") {
			if (!message.session) {
				// Server has no active session — try restoring from localStorage
				const saved = localStorage.getItem("wormhole-last-target");
				if (saved && state.ws && state.ws.readyState === WebSocket.OPEN) {
					const [session, windowStr, paneStr] = saved.split(":");
					const msg: Record<string, unknown> = {
						type: "switch",
						session
					};
					if (windowStr) {
						msg.window = parseInt(windowStr, 10);
					}
					if (paneStr) {
						msg.pane = parseInt(paneStr, 10);
					}
					state.ws.send(JSON.stringify(msg));
				} else {
					sessionTop.hidden = true;
					noSessionEl.hidden = false;
					wormholingEl.hidden = true;
				}
				return;
			}

			sessionTop.hidden = false;
			noSessionEl.hidden = true;
			state.activeWindowIndex = message.window;
			state.activeWindowName = message.windowName;
			sessionNameEl.textContent = message.session;
			updateSessionHint();
			output.innerHTML = "";
			state.rawOutput = "";
			wormholingEl.hidden = false;
			wormholingHint.classList.remove("visible");
			clearTimeout(wormholingTimer);
			wormholingTimer = window.setTimeout(() => {
				if (!wormholingEl.hidden) {
					wormholingHint.classList.add("visible");
				}
			}, WORMHOLING_HINT_MS);
		}

		if (message.type === "pong") {
			recordPing(Date.now() - message.ts);
		}

		if (message.type === "bg-stable") {
			state.readySessions.add(message.session);
			updateSessionHint();
		}

		if (message.type === "bg-clear") {
			state.readySessions.delete(message.session);
			updateSessionHint();
		}
	});

	state.ws.addEventListener("close", () => {
		wsDot.classList.remove("connected");
		wsDot.classList.remove("ping-good", "ping-warn", "ping-poor");
		clearInterval(pingTimer);
		resetPingState();
		state.readySessions.clear();
		updateSessionHint();
		setTimeout(() => {
			connect();
		}, RECONNECT_DELAY_MS);
	});
}

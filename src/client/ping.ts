import { state } from "./state.js";
import { wsDot } from "./dom.js";

export const PING_INTERVAL_MS = 15000;
export const PING_GOOD_MS = 50;
export const PING_WARN_MS = 150;

const PING_HISTORY_SIZE = 3;
const pingHistory: number[] = [];

function getAvgLatency(): number {
	if (pingHistory.length === 0) {
		return -1;
	}
	return Math.round(
		pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length
	);
}

function updateDotColor(): void {
	wsDot.classList.remove("ping-good", "ping-warn", "ping-poor");
	if (state.latencyMs < 0) {
		return;
	}

	if (state.latencyMs <= PING_GOOD_MS) {
		wsDot.classList.add("ping-good");
	} else if (state.latencyMs <= PING_WARN_MS) {
		wsDot.classList.add("ping-warn");
	} else {
		wsDot.classList.add("ping-poor");
	}
}

export function recordPing(rtt: number): void {
	pingHistory.push(rtt);
	if (pingHistory.length > PING_HISTORY_SIZE) {
		pingHistory.shift();
	}
	state.latencyMs = getAvgLatency();
	updateDotColor();
}

export function sendPing(): void {
	if (state.ws && state.ws.readyState === WebSocket.OPEN) {
		state.ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
	}
}

export function resetPingState(): void {
	pingHistory.length = 0;
	state.latencyMs = -1;
}

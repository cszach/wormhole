import { execFile } from "node:child_process";

const SESSION = process.env.TMUX_SESSION ?? "claude";

export function sendKeys(text: string): Promise<void> {
	const clean = text.replace(/[\r\n]+/g, " ");

	return new Promise((resolve, reject) => {
		// Send text literally (-l) to avoid interpreting special keys
		execFile("tmux", ["send-keys", "-t", SESSION, "-l", clean], (error) => {
			if (error) {
				reject(error);

				return;
			}

			// Send Enter as a separate keystroke
			execFile("tmux", ["send-keys", "-t", SESSION, "Enter"], (enterError) => {
				if (enterError) {
					reject(enterError);
				} else {
					resolve();
				}
			});
		});
	});
}

const ALLOWED_KEYS = new Set([
	"BTab",
	"Escape",
	"Up",
	"Down",
	"Left",
	"Right",
	"Enter",
	"Tab",
	"Home",
	"End",
	"PgUp",
	"PgDn"
]);

const MODIFIER_RE = /^(C-|M-|S-)+(.)$/;

function isAllowedKey(key: string): boolean {
	if (ALLOWED_KEYS.has(key)) {
		return true;
	}

	// Allow modifier combos: C-c, M-x, S-Up, C-S-x, etc.
	if (MODIFIER_RE.test(key)) {
		return true;
	}

	// Allow modifier + named key: C-Home, S-Up, etc.
	const parts = key.split("-");
	const base = parts[parts.length - 1];
	const mods = parts.slice(0, -1);

	if (
		mods.length > 0 &&
		mods.every((m) => m === "C" || m === "M" || m === "S") &&
		ALLOWED_KEYS.has(base)
	) {
		return true;
	}

	return false;
}

export function sendRawKey(key: string): Promise<void> {
	if (!isAllowedKey(key)) {
		return Promise.reject(new Error("Key not allowed"));
	}

	return new Promise((resolve, reject) => {
		execFile("tmux", ["send-keys", "-t", SESSION, key], (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export function resizePane(cols: number): Promise<void> {
	const clamped = Math.max(40, Math.min(300, Math.round(cols)));

	return new Promise((resolve, reject) => {
		execFile(
			"tmux",
			["resize-window", "-t", SESSION, "-x", String(clamped)],
			(error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}
		);
	});
}

export function capturePane(): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"tmux",
			["capture-pane", "-t", SESSION, "-p", "-e", "-S", "-500"],
			(error, stdout) => {
				if (error) {
					reject(error);
				} else {
					resolve(stdout);
				}
			}
		);
	});
}

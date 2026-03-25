import { execFile } from "node:child_process";

const SESSION = process.env.TMUX_SESSION ?? "claude";

export function sendKeys(text: string): Promise<void> {
	const clean = text.replace(/[\r\n]+/g, " ");

	return new Promise((resolve, reject) => {
		// Send text literally (-l) to avoid interpreting special keys
		execFile(
			"tmux",
			["send-keys", "-t", SESSION, "-l", clean],
			(error) => {
				if (error) {
					reject(error);

					return;
				}

				// Send Enter as a separate keystroke
				execFile(
					"tmux",
					["send-keys", "-t", SESSION, "Enter"],
					(enterError) => {
						if (enterError) {
							reject(enterError);
						} else {
							resolve();
						}
					}
				);
			}
		);
	});
}

const ALLOWED_KEYS = new Set(["BTab", "Escape", "Up", "Down", "Enter"]);

export function sendRawKey(key: string): Promise<void> {
	if (!ALLOWED_KEYS.has(key)) {
		return Promise.reject(new Error("Key not allowed"));
	}

	return new Promise((resolve, reject) => {
		execFile(
			"tmux",
			["send-keys", "-t", SESSION, key],
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

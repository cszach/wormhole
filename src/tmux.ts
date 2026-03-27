import { execFile } from "node:child_process";

function exec(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export async function sendKeys(session: string, text: string): Promise<void> {
	const isMultiline = /\r?\n/.test(text.trim());

	if (isMultiline) {
		// Use tmux paste buffer to preserve newlines
		await exec("tmux", ["set-buffer", text]);
		await exec("tmux", ["paste-buffer", "-t", session]);
		await exec("tmux", ["send-keys", "-t", session, "Enter"]);
	} else {
		// Single line: send literally + Enter
		await exec("tmux", ["send-keys", "-t", session, "-l", text]);
		await exec("tmux", ["send-keys", "-t", session, "Enter"]);
	}
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
		mods.every((mod) => mod === "C" || mod === "M" || mod === "S") &&
		ALLOWED_KEYS.has(base)
	) {
		return true;
	}

	return false;
}

export function sendRawKey(session: string, key: string): Promise<void> {
	if (!isAllowedKey(key)) {
		return Promise.reject(new Error("Key not allowed"));
	}

	return new Promise((resolve, reject) => {
		execFile("tmux", ["send-keys", "-t", session, key], (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export function resizePane(session: string, cols: number): Promise<void> {
	const clamped = Math.max(40, Math.min(300, Math.round(cols)));

	return new Promise((resolve, reject) => {
		execFile(
			"tmux",
			["resize-window", "-t", session, "-x", String(clamped)],
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

export function capturePane(session: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"tmux",
			["capture-pane", "-t", session, "-p", "-e", "-S", "-500"],
			(error, stdout) => {
				if (error) {
					reject(error);
				} else {
					resolve(stdout.replace(/\n+$/, "\n"));
				}
			}
		);
	});
}

export function listSessions(): Promise<string[]> {
	return new Promise((resolve) => {
		execFile(
			"tmux",
			["list-sessions", "-F", "#{session_created}:#{session_name}"],
			(error, stdout) => {
				if (error) {
					resolve([]);
				} else {
					resolve(
						stdout
							.trim()
							.split("\n")
							.filter((entry) => entry.length > 0)
							.sort((a, b) => {
								const createdA = parseInt(a.split(":")[0], 10);
								const createdB = parseInt(b.split(":")[0], 10);

								return createdA - createdB;
							})
							.map((entry) => entry.substring(entry.indexOf(":") + 1))
					);
				}
			}
		);
	});
}

export function createSession(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile("tmux", ["new-session", "-d", "-s", name], (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export function setBuffer(value: string): Promise<void> {
	return exec("tmux", ["set-buffer", "--", value]);
}

export function pasteBuffer(session: string): Promise<void> {
	return exec("tmux", ["paste-buffer", "-t", session]);
}

export function deleteBuffer(): Promise<void> {
	return exec("tmux", ["delete-buffer"]);
}

export function killSession(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile("tmux", ["kill-session", "-t", name], (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

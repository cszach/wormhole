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

export function renameSession(oldName: string, newName: string): Promise<void> {
	return exec("tmux", ["rename-session", "-t", oldName, newName]);
}

// --- Window operations ---

export type WindowInfo = {
	index: number;
	name: string;
	active: boolean;
	panes: number;
};

export function listWindows(session: string): Promise<WindowInfo[]> {
	return new Promise((resolve) => {
		execFile(
			"tmux",
			[
				"list-windows",
				"-t",
				session,
				"-F",
				"#{window_index}:#{window_name}:#{window_panes}:#{window_active}"
			],
			(error, stdout) => {
				if (error) {
					resolve([]);
				} else {
					resolve(
						stdout
							.trim()
							.split("\n")
							.filter((line) => line.length > 0)
							.map((line) => {
								const parts = line.split(":");
								const active = parts[parts.length - 1] === "1";
								const panes = parseInt(parts[parts.length - 2], 10);
								const name = parts.slice(1, -2).join(":");
								return {
									index: parseInt(parts[0], 10),
									name,
									active,
									panes
								};
							})
					);
				}
			}
		);
	});
}

export type SessionWithWindows = {
	name: string;
	windows: WindowInfo[];
};

export async function listSessionsWithWindows(): Promise<SessionWithWindows[]> {
	const sessions = await listSessions();
	const results: SessionWithWindows[] = [];

	for (const name of sessions) {
		const windows = await listWindows(name);
		results.push({ name, windows });
	}

	return results;
}

export function createWindow(session: string, name?: string): Promise<void> {
	const args = ["new-window", "-t", session];

	if (name) {
		args.push("-n", name);
	}

	return exec("tmux", args);
}

export function killWindow(session: string, index: number): Promise<void> {
	return exec("tmux", ["kill-window", "-t", `${session}:${index}`]);
}

export function renameWindow(
	session: string,
	index: number,
	newName: string
): Promise<void> {
	return exec("tmux", ["rename-window", "-t", `${session}:${index}`, newName]);
}

export function selectWindow(session: string, index: number): Promise<void> {
	return exec("tmux", ["select-window", "-t", `${session}:${index}`]);
}

// --- Pane operations ---

export type PaneInfo = {
	index: number;
	left: number;
	top: number;
	width: number;
	height: number;
	active: boolean;
};

export type PaneLayout = {
	panes: PaneInfo[];
	windowWidth: number;
	windowHeight: number;
};

export function listPanes(
	session: string,
	windowIndex: number
): Promise<PaneLayout> {
	const target = `${session}:${windowIndex}`;

	return new Promise((resolve) => {
		execFile(
			"tmux",
			[
				"list-panes",
				"-t",
				target,
				"-F",
				"#{pane_index}:#{pane_left}:#{pane_top}:#{pane_width}:#{pane_height}:#{pane_active}:#{window_width}:#{window_height}"
			],
			(error, stdout) => {
				if (error) {
					resolve({ panes: [], windowWidth: 0, windowHeight: 0 });
					return;
				}

				let windowWidth = 0;
				let windowHeight = 0;
				const panes: PaneInfo[] = [];

				for (const line of stdout.trim().split("\n")) {
					if (!line) {continue;}
					const p = line.split(":");
					windowWidth = parseInt(p[6], 10);
					windowHeight = parseInt(p[7], 10);
					panes.push({
						index: parseInt(p[0], 10),
						left: parseInt(p[1], 10),
						top: parseInt(p[2], 10),
						width: parseInt(p[3], 10),
						height: parseInt(p[4], 10),
						active: p[5] === "1"
					});
				}

				resolve({ panes, windowWidth, windowHeight });
			}
		);
	});
}

export function capturePanePreview(
	session: string,
	windowIndex: number,
	paneIndex: number
): Promise<string> {
	const target = `${session}:${windowIndex}.${paneIndex}`;

	return new Promise((resolve) => {
		execFile(
			"tmux",
			["capture-pane", "-t", target, "-p", "-S", "-2"],
			(error, stdout) => {
				if (error) {
					resolve("");
				} else {
					const lines = stdout.trimEnd().split("\n");
					resolve(lines[lines.length - 1] ?? "");
				}
			}
		);
	});
}

export function selectPane(
	session: string,
	windowIndex: number,
	paneIndex: number
): Promise<void> {
	return exec("tmux", [
		"select-pane",
		"-t",
		`${session}:${windowIndex}.${paneIndex}`
	]);
}

export function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export function isClaudeCode(content: string): boolean {
	const lines = content.split("\n");
	const bottom = lines.slice(-4).join("\n");
	const stripped = stripAnsi(bottom);

	return /⏵⏵|⏸|shift\+tab|for shortcuts|bypass permissions|accept edits|plan mode/.test(
		stripped
	);
}

export function extractMode(content: string): string {
	const lines = content.split("\n");
	const bottom = lines.slice(-10).join("\n");
	const stripped = stripAnsi(bottom);

	const match = stripped.match(
		/bypass permissions on|accept edits on|plan mode on/i
	);

	if (match) {
		const mode = match[0].toLowerCase().replace(/\s+on$/, "");

		if (mode === "bypass permissions") {
			return "bypass";
		}

		if (mode === "accept edits") {
			return "accept";
		}

		if (mode === "plan mode") {
			return "plan";
		}

		return mode;
	}

	return "default";
}

export function extractLatestResponse(text: string): string {
	const lines = text.split("\n");

	let promptIdx = -1;

	for (let i = lines.length - 1; i >= 0; i--) {
		const trimmed = lines[i].trim();

		if (/^❯\s+\S/.test(trimmed)) {
			promptIdx = i;
			break;
		}
	}

	const responseLines = promptIdx >= 0 ? lines.slice(promptIdx + 1) : lines;

	const filtered = responseLines.filter((line) => {
		const trimmed = line.trim();

		if (!trimmed) {
			return false;
		}

		if (/[╭╮╰╯│─┌┐└┘├┤┬┴┼]/.test(trimmed)) {
			return false;
		}

		if (/^[─━═]+$/.test(trimmed)) {
			return false;
		}

		if (/bypass|permissions|auto-update|⏵/i.test(trimmed)) {
			return false;
		}

		// Single-char prompts/indicators on their own line
		if (/^\S(\s*)$/.test(trimmed) && !/^[a-zA-Z0-9]/.test(trimmed)) {
			return false;
		}

		// Thinking/status indicators: ✽ Kneading…, * Hashing…, · Cooked for 3s
		if (/^\S\s+\S+…/.test(trimmed)) {
			return false;
		}

		if (/^\S\s+\S+\s+for\s+\d/.test(trimmed)) {
			return false;
		}

		// Project name bar
		if (/wormhole-mobile-voice/i.test(trimmed)) {
			return false;
		}

		if (/^●\s+(Bash|Read|Write|Edit|Glob|Grep|Agent)\s*\(/.test(trimmed)) {
			return false;
		}

		if (/^⎿/.test(trimmed)) {
			return false;
		}

		return true;
	});

	return filtered
		.map((line) => line.replace(/^(\s*)●\s*/, "$1"))
		.join("\n")
		.trim();
}

export function cleanTextForSend(text: string): string {
	return text.replace(/[\r\n]+/g, " ");
}

const ALLOWED_BASE_KEYS = new Set([
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

export function isAllowedKey(key: string): boolean {
	if (ALLOWED_BASE_KEYS.has(key)) {
		return true;
	}

	// Modifier combos: C-c, M-x, S-Up, C-S-x, etc.
	if (/^(C-|M-|S-)+(.)$/.test(key)) {
		return true;
	}

	// Modifier + named key: C-Home, S-Up, etc.
	const parts = key.split("-");
	const base = parts[parts.length - 1];
	const mods = parts.slice(0, -1);

	if (
		mods.length > 0 &&
		mods.every((m) => m === "C" || m === "M" || m === "S") &&
		ALLOWED_BASE_KEYS.has(base)
	) {
		return true;
	}

	return false;
}

export function extractSummary(text: string): string {
	const lines = text.split("\n");

	// Walk backwards to find the last prose paragraph,
	// skipping blank lines, code (indented 4+ spaces or
	// tab-indented), file paths, and diff lines.

	let endIdx = lines.length - 1;

	// Skip trailing blank lines
	while (endIdx >= 0 && !lines[endIdx].trim()) {
		endIdx--;
	}

	if (endIdx < 0) {
		return "";
	}

	// Collect the last prose block (consecutive non-code lines)
	const proseLines: string[] = [];
	let i = endIdx;

	while (i >= 0) {
		const line = lines[i];
		const trimmed = line.trim();

		// Stop at blank line (paragraph boundary)
		if (!trimmed) {
			if (proseLines.length > 0) {
				break;
			}

			i--;
			continue;
		}

		// Skip code-like lines (indented 4+ spaces, tabs, or common code patterns)
		if (/^\s{4,}\S/.test(line) || /^\t/.test(line)) {
			if (proseLines.length > 0) {
				break;
			}

			i--;
			continue;
		}

		// Skip diff lines
		if (/^[+-]{3}\s|^@@\s|^[+-]\s/.test(trimmed)) {
			if (proseLines.length > 0) {
				break;
			}

			i--;
			continue;
		}

		// Skip file paths
		if (
			/^(src|public|node_modules)\//.test(trimmed) ||
			/\.\w{1,4}:\d+/.test(trimmed)
		) {
			if (proseLines.length > 0) {
				break;
			}

			i--;
			continue;
		}

		proseLines.unshift(trimmed);
		i--;
	}

	return proseLines.join(" ").trim();
}

export function getTTSText(rawOutput: string, mode: string): string {
	const clean = stripAnsi(rawOutput);
	const full = extractLatestResponse(clean);

	if (mode === "summary") {
		return extractSummary(full);
	}

	return full;
}

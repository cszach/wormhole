import { output } from "./dom.js";
import { isKnownPath, isTreeReady, resolveBySuffix } from "./file-browser.js";
import { showToast } from "./toast.js";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

// Split on whitespace and common delimiters, keeping positions
const TOKEN_RE = /[^\s"'`()[\]{}<>,;:!]+/g;

let onPathClick: ((filePath: string) => void) | null = null;

export function setPathClickHandler(handler: (filePath: string) => void): void {
	onPathClick = handler;
}

function normalizePath(token: string): string | null {
	// Strip leading ./
	let p = token.replace(/^\.\//, "");

	// Strip trailing punctuation that's not part of a filename
	p = p.replace(/[.,;:!?]+$/, "");

	// Handle ../ by keeping it as-is — tree paths are relative to cwd
	// so ../foo won't match (which is correct, it's outside cwd)

	if (!p) {
		return null;
	}

	return p;
}

export function linkifyOutput(): void {
	if (!isTreeReady()) {
		return;
	}

	const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT);

	const textNodes: Text[] = [];
	let node: Text | null;

	while ((node = walker.nextNode() as Text | null)) {
		textNodes.push(node);
	}

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";

		if (!text.trim()) {
			continue;
		}

		const matches = findMatches(text);

		if (matches.length === 0) {
			continue;
		}

		const frag = document.createDocumentFragment();
		let lastIdx = 0;

		for (const match of matches) {
			if (match.start > lastIdx) {
				frag.appendChild(
					document.createTextNode(text.slice(lastIdx, match.start))
				);
			}

			const a = document.createElement("a");
			a.className = "output-link";
			a.textContent = match.text;

			if (match.type === "url") {
				a.href = match.text;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
			} else {
				a.href = "#";
				const resolvedPath = match.resolved;
				a.addEventListener("click", (e) => {
					e.preventDefault();
					handlePathClick(resolvedPath);
				});
			}

			frag.appendChild(a);
			lastIdx = match.start + match.text.length;
		}

		if (lastIdx < text.length) {
			frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		}

		textNode.parentNode?.replaceChild(frag, textNode);
	}
}

type Match = {
	text: string;
	start: number;
	type: "url" | "path";
	resolved: string;
};

function findMatches(text: string): Match[] {
	const matches: Match[] = [];

	// Find URLs first
	URL_RE.lastIndex = 0;
	let m: RegExpExecArray | null;

	while ((m = URL_RE.exec(text)) !== null) {
		matches.push({
			text: m[0],
			start: m.index,
			type: "url",
			resolved: m[0]
		});
	}

	// Find path tokens
	TOKEN_RE.lastIndex = 0;

	while ((m = TOKEN_RE.exec(text)) !== null) {
		const start = m.index;
		const end = start + m[0].length;

		// Skip if overlaps with a URL
		const overlaps = matches.some(
			(prev) => start < prev.start + prev.text.length && end > prev.start
		);

		if (overlaps) {
			continue;
		}

		const normalized = normalizePath(m[0]);

		if (!normalized) {
			continue;
		}

		const resolved = resolveBySuffix(normalized);

		if (resolved) {
			const cleanText = m[0].replace(/[.,;:!?]+$/, "");
			matches.push({
				text: cleanText,
				start,
				type: "path",
				resolved
			});
		}
	}

	matches.sort((a, b) => a.start - b.start);
	return matches;
}

function handlePathClick(filePath: string): void {
	if (isKnownPath(filePath) && onPathClick) {
		onPathClick(filePath);
	} else {
		showToast("Outside file browser scope");
	}
}

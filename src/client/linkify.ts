import { output } from "./dom.js";
import { isKnownPath, isTreeReady, resolveBySuffix } from "./file-browser.js";
import { showToast } from "./toast.js";
import { findMatches } from "./linkify-core.js";

let onPathClick: ((filePath: string) => void) | null = null;

export function setPathClickHandler(handler: (filePath: string) => void): void {
	onPathClick = handler;
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

		const matches = findMatches(text, resolveBySuffix);

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

function handlePathClick(filePath: string): void {
	if (isKnownPath(filePath) && onPathClick) {
		onPathClick(filePath);
	} else {
		showToast("Outside file browser scope");
	}
}

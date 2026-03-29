const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const TOKEN_RE = /[^\s"'`()[\]{}<>,;:!]+/g;

export function normalizePath(token: string): string | null {
	let p = token.replace(/^\.\//, "");
	p = p.replace(/[.,;:!?]+$/, "");

	if (!p) {
		return null;
	}

	return p;
}

export type Match = {
	text: string;
	start: number;
	type: "url" | "path";
	resolved: string;
};

export function findMatches(
	text: string,
	resolver: (token: string) => string | null
): Match[] {
	const matches: Match[] = [];

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

	TOKEN_RE.lastIndex = 0;

	while ((m = TOKEN_RE.exec(text)) !== null) {
		const start = m.index;
		const end = start + m[0].length;

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

		const resolved = resolver(normalized);

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

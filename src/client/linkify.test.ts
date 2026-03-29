import { describe, it, expect, beforeEach } from "vitest";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const TOKEN_RE = /[^\s"'`()[\]{}<>,;:!]+/g;

function normalizePath(token: string): string | null {
	let p = token.replace(/^\.\//, "");
	p = p.replace(/[.,;:!?]+$/, "");
	if (!p) {
		return null;
	}
	return p;
}

function resolveBySuffix(token: string, pathSet: Set<string>): string | null {
	if (pathSet.has(token)) {
		return token;
	}

	const suffix = "/" + token;
	let match: string | null = null;

	for (const p of pathSet) {
		if (p === token || p.endsWith(suffix)) {
			if (match !== null) {
				return null;
			}
			match = p;
		}
	}

	return match;
}

type Match = {
	text: string;
	start: number;
	type: "url" | "path";
	resolved: string;
};

function findMatches(text: string, knownPaths: Set<string>): Match[] {
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

		const resolved = resolveBySuffix(normalized, knownPaths);

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

describe("linkify matching", () => {
	let paths: Set<string>;

	beforeEach(() => {
		paths = new Set([
			"package.json",
			"README.md",
			"src/server.ts",
			"src/client/app.ts",
			"src/client/render.ts",
			"public/style.css",
			"docs/src/pages/vault.md",
			"tsconfig.json",
			".gitignore",
			".htmlvalidate.json"
		]);
	});

	it("matches a single filename", () => {
		const matches = findMatches("check package.json for details", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("package.json");
		expect(matches[0].type).toBe("path");
		expect(matches[0].resolved).toBe("package.json");
	});

	it("matches a path with directories", () => {
		const matches = findMatches("edit src/server.ts now", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("src/server.ts");
		expect(matches[0].type).toBe("path");
	});

	it("matches a deep path", () => {
		const matches = findMatches("see src/client/app.ts", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("src/client/app.ts");
		expect(matches[0].type).toBe("path");
	});

	it("matches paths with ./ prefix", () => {
		const matches = findMatches("open ./public/style.css", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("./public/style.css");
		expect(matches[0].resolved).toBe("public/style.css");
	});

	it("matches multiple paths in one line", () => {
		const matches = findMatches(
			"src/server.ts and package.json and README.md",
			paths
		);
		expect(matches).toHaveLength(3);
		expect(matches.map((m) => m.resolved)).toEqual([
			"src/server.ts",
			"package.json",
			"README.md"
		]);
	});

	it("matches dotfiles", () => {
		const matches = findMatches("check .gitignore", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe(".gitignore");
	});

	it("matches dotfiles with extensions", () => {
		const matches = findMatches("see .htmlvalidate.json", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe(".htmlvalidate.json");
	});

	it("strips trailing punctuation", () => {
		const matches = findMatches("edit package.json, then restart.", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("package.json");
	});

	it("strips trailing colon", () => {
		const matches = findMatches("in src/server.ts:", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/server.ts");
	});

	it("does not match unknown paths", () => {
		const matches = findMatches("open foo/bar/baz.txt", paths);
		expect(matches).toHaveLength(0);
	});

	it("does not match plain words", () => {
		const matches = findMatches("hello world foo bar", paths);
		expect(matches).toHaveLength(0);
	});

	it("matches URLs", () => {
		const matches = findMatches(
			"visit https://github.com/cszach/wormhole",
			paths
		);
		expect(matches).toHaveLength(1);
		expect(matches[0].type).toBe("url");
	});

	it("matches both URLs and paths", () => {
		const matches = findMatches(
			"see https://example.com and package.json",
			paths
		);
		expect(matches).toHaveLength(2);
		expect(matches[0].type).toBe("url");
		expect(matches[1].type).toBe("path");
	});

	it("does not linkify paths inside URLs", () => {
		const matches = findMatches(
			"https://github.com/cszach/wormhole/blob/main/package.json",
			paths
		);
		expect(matches).toHaveLength(1);
		expect(matches[0].type).toBe("url");
	});

	it("handles paths at start of text", () => {
		const matches = findMatches("package.json is the config", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].start).toBe(0);
	});

	it("handles paths at end of text", () => {
		const matches = findMatches("editing src/client/app.ts", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("handles path followed by colon and line number", () => {
		const matches = findMatches("src/server.ts:42", paths);
		expect(matches.some((m) => m.resolved === "src/server.ts")).toBe(true);
	});

	it("handles empty string", () => {
		expect(findMatches("", paths)).toHaveLength(0);
	});

	it("handles whitespace only", () => {
		expect(findMatches("   \t  ", paths)).toHaveLength(0);
	});

	// --- Suffix matching ---

	it("resolves bare filename to unique full path", () => {
		const matches = findMatches("edit server.ts", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("server.ts");
		expect(matches[0].resolved).toBe("src/server.ts");
	});

	it("resolves partial path suffix", () => {
		const matches = findMatches("check client/app.ts", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("resolves deep partial path", () => {
		const matches = findMatches("see pages/vault.md", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("docs/src/pages/vault.md");
	});

	it("does not resolve ambiguous bare filename", () => {
		// Both src/client/app.ts and src/client/render.ts exist,
		// but "app.ts" is unique
		const matches = findMatches("open app.ts", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("does not link truly ambiguous names", () => {
		// Add a second server.ts to make it ambiguous
		paths.add("lib/server.ts");
		const matches = findMatches("edit server.ts", paths);
		expect(matches).toHaveLength(0);
	});

	it("prefers exact match over suffix", () => {
		const matches = findMatches("open README.md", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("README.md");
	});

	it("resolves style.css to public/style.css", () => {
		const matches = findMatches("edit style.css", paths);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("public/style.css");
	});
});

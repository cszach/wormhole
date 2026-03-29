import { describe, it, expect, beforeEach } from "vitest";

import { findMatches } from "./linkify-core.js";

function makeResolver(pathSet: Set<string>) {
	return (token: string): string | null => {
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
	};
}

describe("linkify matching", () => {
	let resolve: (token: string) => string | null;

	beforeEach(() => {
		resolve = makeResolver(
			new Set([
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
			])
		);
	});

	it("matches a single filename", () => {
		const matches = findMatches("check package.json for details", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("package.json");
		expect(matches[0].type).toBe("path");
		expect(matches[0].resolved).toBe("package.json");
	});

	it("matches a path with directories", () => {
		const matches = findMatches("edit src/server.ts now", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("src/server.ts");
		expect(matches[0].type).toBe("path");
	});

	it("matches a deep path", () => {
		const matches = findMatches("see src/client/app.ts", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("src/client/app.ts");
		expect(matches[0].type).toBe("path");
	});

	it("matches paths with ./ prefix", () => {
		const matches = findMatches("open ./public/style.css", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("./public/style.css");
		expect(matches[0].resolved).toBe("public/style.css");
	});

	it("matches multiple paths in one line", () => {
		const matches = findMatches(
			"src/server.ts and package.json and README.md",
			resolve
		);
		expect(matches).toHaveLength(3);
		expect(matches.map((m) => m.resolved)).toEqual([
			"src/server.ts",
			"package.json",
			"README.md"
		]);
	});

	it("matches dotfiles", () => {
		const matches = findMatches("check .gitignore", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe(".gitignore");
	});

	it("matches dotfiles with extensions", () => {
		const matches = findMatches("see .htmlvalidate.json", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe(".htmlvalidate.json");
	});

	it("strips trailing punctuation", () => {
		const matches = findMatches("edit package.json, then restart.", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("package.json");
	});

	it("strips trailing colon", () => {
		const matches = findMatches("in src/server.ts:", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/server.ts");
	});

	it("does not match unknown paths", () => {
		const matches = findMatches("open foo/bar/baz.txt", resolve);
		expect(matches).toHaveLength(0);
	});

	it("does not match plain words", () => {
		const matches = findMatches("hello world foo bar", resolve);
		expect(matches).toHaveLength(0);
	});

	it("matches URLs", () => {
		const matches = findMatches(
			"visit https://github.com/cszach/wormhole",
			resolve
		);
		expect(matches).toHaveLength(1);
		expect(matches[0].type).toBe("url");
	});

	it("matches both URLs and paths", () => {
		const matches = findMatches(
			"see https://example.com and package.json",
			resolve
		);
		expect(matches).toHaveLength(2);
		expect(matches[0].type).toBe("url");
		expect(matches[1].type).toBe("path");
	});

	it("does not linkify paths inside URLs", () => {
		const matches = findMatches(
			"https://github.com/cszach/wormhole/blob/main/package.json",
			resolve
		);
		expect(matches).toHaveLength(1);
		expect(matches[0].type).toBe("url");
	});

	it("handles paths at start of text", () => {
		const matches = findMatches("package.json is the config", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].start).toBe(0);
	});

	it("handles paths at end of text", () => {
		const matches = findMatches("editing src/client/app.ts", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("handles path followed by colon and line number", () => {
		const matches = findMatches("src/server.ts:42", resolve);
		expect(matches.some((m) => m.resolved === "src/server.ts")).toBe(true);
	});

	it("handles empty string", () => {
		expect(findMatches("", resolve)).toHaveLength(0);
	});

	it("handles whitespace only", () => {
		expect(findMatches("   \t  ", resolve)).toHaveLength(0);
	});

	// --- Suffix matching ---

	it("resolves bare filename to unique full path", () => {
		const matches = findMatches("edit server.ts", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].text).toBe("server.ts");
		expect(matches[0].resolved).toBe("src/server.ts");
	});

	it("resolves partial path suffix", () => {
		const matches = findMatches("check client/app.ts", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("resolves deep partial path", () => {
		const matches = findMatches("see pages/vault.md", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("docs/src/pages/vault.md");
	});

	it("resolves unique bare filename", () => {
		const matches = findMatches("open app.ts", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("src/client/app.ts");
	});

	it("does not link truly ambiguous names", () => {
		const ambiguous = makeResolver(new Set(["src/server.ts", "lib/server.ts"]));
		const matches = findMatches("edit server.ts", ambiguous);
		expect(matches).toHaveLength(0);
	});

	it("prefers exact match over suffix", () => {
		const matches = findMatches("open README.md", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("README.md");
	});

	it("resolves style.css to public/style.css", () => {
		const matches = findMatches("edit style.css", resolve);
		expect(matches).toHaveLength(1);
		expect(matches[0].resolved).toBe("public/style.css");
	});
});

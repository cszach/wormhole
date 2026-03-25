import { describe, it, expect } from "vitest";

import {
	stripAnsi,
	isClaudeCode,
	extractMode,
	isChromeLine,
	stripChrome,
	extractLatestResponse,
	extractSummary,
	cleanTextForSend,
	isAllowedKey,
	getTTSText
} from "./text-processing.js";

describe("stripAnsi", () => {
	it("removes color codes", () => {
		expect(stripAnsi("\x1b[38;5;37mhello\x1b[39m")).toBe("hello");
	});

	it("removes multiple codes", () => {
		expect(stripAnsi("\x1b[1mbold\x1b[0m \x1b[31mred\x1b[0m")).toBe("bold red");
	});

	it("returns plain text unchanged", () => {
		expect(stripAnsi("no codes here")).toBe("no codes here");
	});

	it("handles empty string", () => {
		expect(stripAnsi("")).toBe("");
	});
});

describe("isClaudeCode", () => {
	it("detects Claude Code by bypass permissions", () => {
		const content = [
			"some output",
			"⏵⏵ bypass permissions on (shift+tab to cycle)"
		].join("\n");

		expect(isClaudeCode(content)).toBe(true);
	});

	it("detects Claude Code by shortcuts hint", () => {
		const content = ["some output", "? for shortcuts"].join("\n");

		expect(isClaudeCode(content)).toBe(true);
	});

	it("detects Claude Code by plan mode", () => {
		const content = ["some output", "⏸ plan mode on (shift+tab to cycle)"].join(
			"\n"
		);

		expect(isClaudeCode(content)).toBe(true);
	});

	it("returns false for plain terminal", () => {
		const content = [
			"$ ls -la",
			"total 42",
			"drwxr-xr-x  5 user user 4096 Mar 25 10:00 .",
			"$ "
		].join("\n");

		expect(isClaudeCode(content)).toBe(false);
	});

	it("returns false for empty output", () => {
		expect(isClaudeCode("")).toBe(false);
	});
});

describe("extractMode", () => {
	it("extracts bypass permissions", () => {
		const content = [
			"some conversation",
			"───────────────",
			"❯\u00A0",
			"───────────────",
			"⏵⏵ bypass permissions on (shift+tab to cycle)"
		].join("\n");

		expect(extractMode(content)).toBe("bypass");
	});

	it("extracts accept edits", () => {
		const content = [
			"some text",
			"⏵⏵ accept edits on (shift+tab to cycle)"
		].join("\n");

		expect(extractMode(content)).toBe("accept");
	});

	it("extracts plan mode", () => {
		const content = ["some text", "⏸ plan mode on (shift+tab to cycle)"].join(
			"\n"
		);

		expect(extractMode(content)).toBe("plan");
	});

	it("returns default when no mode found", () => {
		const content = ["some text", "? for shortcuts"].join("\n");

		expect(extractMode(content)).toBe("default");
	});

	it("only searches last 10 lines", () => {
		const filler = Array(20).fill("filler line");
		const content = [
			"⏵⏵ bypass permissions on (shift+tab)",
			...filler,
			"? for shortcuts"
		].join("\n");

		expect(extractMode(content)).toBe("default");
	});

	it("handles ANSI codes in mode line", () => {
		const content = [
			"text",
			"\x1b[38;5;211m⏵⏵\x1b[39m \x1b[38;5;211mbypass\x1b[39m \x1b[38;5;211mpermissions\x1b[39m \x1b[38;5;211mon\x1b[39m"
		].join("\n");

		expect(extractMode(content)).toBe("bypass");
	});
});

describe("isChromeLine", () => {
	it("treats empty string as chrome", () => {
		expect(isChromeLine("")).toBe(true);
	});

	it("treats whitespace-only as chrome", () => {
		expect(isChromeLine("   ")).toBe(true);
	});

	it("treats box-drawing lines as chrome", () => {
		expect(isChromeLine("────────────────────")).toBe(true);
	});

	it("treats status bar with shift+tab as chrome", () => {
		expect(isChromeLine("⏵⏵ bypass permissions on (shift+tab to cycle)")).toBe(
			true
		);
	});

	it("treats ⏵⏵ lines as chrome", () => {
		expect(isChromeLine("⏵⏵ accept edits on")).toBe(true);
	});

	it("treats ⏸ lines as chrome", () => {
		expect(isChromeLine("⏸ plan mode on (shift+tab to cycle)")).toBe(true);
	});

	it("treats effort indicator as chrome", () => {
		expect(isChromeLine("● high · /effort")).toBe(true);
	});

	it("treats esc to interrupt as chrome", () => {
		expect(isChromeLine("  esc to interrupt")).toBe(true);
	});

	it("treats ? for shortcuts as chrome", () => {
		expect(isChromeLine("? for shortcuts")).toBe(true);
	});

	it("treats empty prompt as chrome", () => {
		expect(isChromeLine("❯ ")).toBe(true);
		expect(isChromeLine("❯\u00A0")).toBe(true);
		expect(isChromeLine("❯")).toBe(true);
	});

	it("treats project name bar as chrome", () => {
		expect(isChromeLine("───── wormhole-mobile-voice-interface ──")).toBe(true);
	});

	it("treats thinking indicators as chrome", () => {
		expect(isChromeLine("· Thinking… (5s · ↓ 100 tokens)")).toBe(true);
		expect(isChromeLine("✢ Meandering… (39s · ↓ 217 tokens)")).toBe(true);
		expect(isChromeLine("✽ Waddling… (12s)")).toBe(true);
		expect(isChromeLine("✻ Baked for 3m 16s")).toBe(true);
		expect(isChromeLine("✶ Kneading… (57s · ↓ 224 tokens)")).toBe(true);
		// Without timing — just the word with ellipsis
		expect(isChromeLine("✽ Kneading…")).toBe(true);
		expect(isChromeLine("· Simmering…")).toBe(true);
	});

	it("does NOT treat Claude response as chrome", () => {
		expect(isChromeLine("● Here is my response")).toBe(false);
		expect(isChromeLine("  continuation of response")).toBe(false);
		expect(isChromeLine("Hello, how can I help?")).toBe(false);
	});

	it("does NOT treat user prompt with text as chrome", () => {
		expect(isChromeLine("❯ what is the weather")).toBe(false);
	});

	it("handles ANSI-wrapped chrome lines", () => {
		expect(
			isChromeLine("\x1b[38;5;211m⏵⏵\x1b[39m \x1b[38;5;211mbypass\x1b[39m")
		).toBe(true);
	});
});

describe("stripChrome", () => {
	it("strips status bar from bottom", () => {
		const content = [
			"● Hello there",
			"  How are you?",
			"",
			"───────────────",
			"❯\u00A0",
			"───────────────",
			"⏵⏵ bypass permissions on (shift+tab to cycle)",
			""
		].join("\n");

		const result = stripChrome(content);
		const lines = result.split("\n").filter((l) => l.trim());

		expect(lines[lines.length - 1]).toContain("How are you?");
	});

	it("strips at most 12 lines", () => {
		const conversation = Array(20).fill("conversation line");
		const chrome = Array(15).fill("");

		const content = [...conversation, ...chrome].join("\n");
		const result = stripChrome(content);
		const lines = result.split("\n");

		expect(lines.length).toBe(23);
	});

	it("preserves content when no chrome at bottom", () => {
		const content = "line 1\nline 2\nline 3";

		expect(stripChrome(content)).toBe(content);
	});

	it("handles full Claude Code output", () => {
		const content = [
			"● Here is my response to your question.",
			"  It has multiple lines.",
			"",
			"· Cooked for 5s",
			"",
			"───────────────────── wormhole-mobile-voice-interface ──",
			"❯\u00A0",
			"────────────────────────────────────────────────────────",
			"  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc…",
			"  ● high · /effort",
			""
		].join("\n");

		const result = stripChrome(content);
		expect(result).toContain("response to your question");
		expect(result).not.toContain("bypass");
		expect(result).not.toContain("wormhole-mobile-voice");
	});
});

describe("extractLatestResponse", () => {
	it("extracts text after last user prompt", () => {
		const text = ["❯ hello", "● Hi there!", "  How can I help?"].join("\n");

		const result = extractLatestResponse(text);
		expect(result).toBe("Hi there!\n  How can I help?");
	});

	it("strips ● bullet from response lines", () => {
		const text = ["❯ test", "● First paragraph", "● Second paragraph"].join(
			"\n"
		);

		const result = extractLatestResponse(text);
		expect(result).toBe("First paragraph\nSecond paragraph");
	});

	it("filters out tool call lines", () => {
		const text = [
			"❯ fix the bug",
			"● Let me look at the code.",
			"● Bash(npm test)",
			"⎿  All tests passed",
			"● Done, the bug is fixed."
		].join("\n");

		const result = extractLatestResponse(text);
		expect(result).toContain("Let me look at the code.");
		expect(result).toContain("Done, the bug is fixed.");
		expect(result).not.toContain("Bash");
		expect(result).not.toContain("⎿");
	});

	it("filters out chrome lines", () => {
		const text = [
			"❯ hello",
			"● Hi!",
			"───────────────",
			"⏵⏵ bypass permissions on"
		].join("\n");

		const result = extractLatestResponse(text);
		expect(result).toBe("Hi!");
	});

	it("uses last prompt when multiple exist", () => {
		const text = [
			"❯ first question",
			"● First answer",
			"❯ second question",
			"● Second answer"
		].join("\n");

		const result = extractLatestResponse(text);
		expect(result).toBe("Second answer");
	});

	it("returns all content if no prompt found", () => {
		const text = "● Some response text";

		expect(extractLatestResponse(text)).toBe("Some response text");
	});

	it("filters out thinking indicators", () => {
		const text = ["❯ think about this", "● Here is my thought.", "✢"].join(
			"\n"
		);

		const result = extractLatestResponse(text);
		expect(result).toBe("Here is my thought.");
	});
});

describe("cleanTextForSend", () => {
	it("replaces newlines with spaces", () => {
		expect(cleanTextForSend("line1\nline2")).toBe("line1 line2");
	});

	it("replaces carriage returns", () => {
		expect(cleanTextForSend("line1\r\nline2")).toBe("line1 line2");
	});

	it("collapses multiple newlines", () => {
		expect(cleanTextForSend("a\n\n\nb")).toBe("a b");
	});

	it("leaves single-line text unchanged", () => {
		expect(cleanTextForSend("hello world")).toBe("hello world");
	});
});

describe("isAllowedKey", () => {
	it("allows BTab", () => {
		expect(isAllowedKey("BTab")).toBe(true);
	});

	it("allows Escape", () => {
		expect(isAllowedKey("Escape")).toBe(true);
	});

	it("allows Up", () => {
		expect(isAllowedKey("Up")).toBe(true);
	});

	it("allows Down", () => {
		expect(isAllowedKey("Down")).toBe(true);
	});

	it("allows Enter", () => {
		expect(isAllowedKey("Enter")).toBe(true);
	});

	it("allows Left and Right", () => {
		expect(isAllowedKey("Left")).toBe(true);
		expect(isAllowedKey("Right")).toBe(true);
	});

	it("allows Tab", () => {
		expect(isAllowedKey("Tab")).toBe(true);
	});

	it("allows Ctrl combos", () => {
		expect(isAllowedKey("C-o")).toBe(true);
		expect(isAllowedKey("C-c")).toBe(true);
	});

	it("rejects arbitrary keys", () => {
		expect(isAllowedKey("Delete")).toBe(false);
		expect(isAllowedKey("q")).toBe(false);
		expect(isAllowedKey("C-z")).toBe(false);
	});
});

describe("getTTSText", () => {
	it("strips ANSI and extracts response for TTS", () => {
		const raw = [
			"\x1b[38;5;246m❯\x1b[39m tell me a joke",
			"\x1b[38;5;255m●\x1b[39m Why did the chicken cross the road?",
			"  To get to the other side!"
		].join("\n");

		const result = getTTSText(raw, "full");
		expect(result).toBe(
			"Why did the chicken cross the road?\n  To get to the other side!"
		);
	});

	it("does not include user prompt in TTS", () => {
		const raw = ["❯ what is 2+2", "● The answer is 4."].join("\n");

		expect(getTTSText(raw, "full")).toBe("The answer is 4.");
		expect(getTTSText(raw, "full")).not.toContain("what is 2+2");
	});

	it("does not include tool calls in TTS", () => {
		const raw = [
			"❯ fix the bug",
			"● I found the issue.",
			"● Bash(npm test)",
			"⎿  Tests passed",
			"● All fixed now."
		].join("\n");

		const result = getTTSText(raw, "full");
		expect(result).toContain("I found the issue.");
		expect(result).toContain("All fixed now.");
		expect(result).not.toContain("Bash");
		expect(result).not.toContain("Tests passed");
	});

	it("does not include chrome in TTS", () => {
		const raw = [
			"❯ hello",
			"● Hi there!",
			"───────────────────",
			"❯\u00A0",
			"⏵⏵ bypass permissions on (shift+tab to cycle)"
		].join("\n");

		const result = getTTSText(raw, "full");
		expect(result).toBe("Hi there!");
		expect(result).not.toContain("bypass");
		expect(result).not.toContain("───");
	});

	it("strips ● bullet so TTS does not say 'filled circle'", () => {
		const raw = ["❯ test", "● This is my response."].join("\n");

		expect(getTTSText(raw, "full")).toBe("This is my response.");
		expect(getTTSText(raw, "full")).not.toContain("●");
	});

	it("handles realistic full Claude Code output", () => {
		const raw = [
			"\x1b[38;5;246m❯\x1b[39m how are you",
			"",
			"\x1b[38;5;255m●\x1b[39m I'm doing great, thanks for asking!",
			"  How can I help you today?",
			"",
			"\x1b[38;5;174m✢\x1b[39m \x1b[38;5;216mCooked\x1b[39m for 3s",
			"",
			"\x1b[38;5;37m━━━━━━━━━━━ wormhole-mobile-voice-interface ━━\x1b[39m",
			"\x1b[38;5;246m❯\x1b[39m\u00A0",
			"\x1b[38;5;37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[39m",
			"\x1b[38;5;211m⏵⏵\x1b[39m bypass permissions on (shift+tab to cycle)",
			""
		].join("\n");

		const result = getTTSText(raw, "full");
		expect(result).toBe(
			"I'm doing great, thanks for asking!\n  How can I help you today?"
		);
	});

	it("returns empty string when no response content", () => {
		const raw = [
			"───────────────",
			"❯\u00A0",
			"───────────────",
			"⏵⏵ bypass permissions on"
		].join("\n");

		expect(getTTSText(raw, "full")).toBe("");
	});
});

describe("extractSummary", () => {
	it("extracts the last prose paragraph", () => {
		const text = [
			"I looked at the code and found the issue.",
			"",
			"Here are the changes I made:",
			"    const x = 1;",
			"    const y = 2;",
			"",
			"Everything is fixed now. Let me know if you need anything else."
		].join("\n");

		expect(extractSummary(text)).toBe(
			"Everything is fixed now. Let me know if you need anything else."
		);
	});

	it("skips code blocks (indented lines)", () => {
		const text = [
			"I updated the function:",
			"",
			"    function hello() {",
			"        return 'world';",
			"    }",
			"",
			"Done. The function now returns the correct value."
		].join("\n");

		expect(extractSummary(text)).toBe(
			"Done. The function now returns the correct value."
		);
	});

	it("skips diff lines", () => {
		const text = [
			"Here's the diff:",
			"--- a/file.ts",
			"+++ b/file.ts",
			"+ const x = 1;",
			"- const x = 2;",
			"",
			"Applied the fix."
		].join("\n");

		expect(extractSummary(text)).toBe("Applied the fix.");
	});

	it("returns last non-empty line when no paragraph break", () => {
		const text = "Just a single response line.";

		expect(extractSummary(text)).toBe("Just a single response line.");
	});

	it("handles multi-line last paragraph", () => {
		const text = [
			"Some earlier stuff.",
			"",
			"In summary, this worked great.",
			"All tests pass and the build is clean."
		].join("\n");

		expect(extractSummary(text)).toBe(
			"In summary, this worked great. All tests pass and the build is clean."
		);
	});

	it("returns empty for empty input", () => {
		expect(extractSummary("")).toBe("");
		expect(extractSummary("   \n  \n  ")).toBe("");
	});
});

describe("getTTSText summary mode", () => {
	it("returns summary instead of full response", () => {
		const raw = [
			"❯ fix the bug",
			"● I looked at the code and found several issues.",
			"  Here is what I changed:",
			"",
			"    const x = newValue;",
			"    const y = otherValue;",
			"",
			"● All fixed. Tests pass."
		].join("\n");

		const full = getTTSText(raw, "full");
		const summary = getTTSText(raw, "summary");

		expect(full).toContain("I looked at the code");
		expect(summary).toBe("All fixed. Tests pass.");
	});
});

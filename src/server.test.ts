import { describe, it, expect } from "vitest";

import { isValidSessionName } from "./validation.js";

describe("isValidSessionName", () => {
	it("accepts a simple name", () => {
		expect(isValidSessionName("claude")).toBeNull();
	});

	it("accepts hyphens and underscores", () => {
		expect(isValidSessionName("my-session_1")).toBeNull();
	});

	it("accepts a single character", () => {
		expect(isValidSessionName("a")).toBeNull();
	});

	it("accepts exactly 20 characters", () => {
		expect(isValidSessionName("a".repeat(20))).toBeNull();
	});

	it("rejects empty string", () => {
		expect(isValidSessionName("")).toBe("Session name cannot be empty");
	});

	it("rejects whitespace-only string", () => {
		expect(isValidSessionName("   ")).toBe("Session name cannot be empty");
	});

	it("rejects name longer than 20 characters", () => {
		expect(isValidSessionName("a".repeat(21))).toBe(
			"Session name must be 20 characters or fewer"
		);
	});

	it("rejects name containing a dot", () => {
		expect(isValidSessionName("my.session")).toBe(
			"Session name cannot contain . or :"
		);
	});

	it("rejects name containing a colon", () => {
		expect(isValidSessionName("my:session")).toBe(
			"Session name cannot contain . or :"
		);
	});

	it("rejects name with both dot and colon", () => {
		expect(isValidSessionName("a.b:c")).toBe(
			"Session name cannot contain . or :"
		);
	});
});

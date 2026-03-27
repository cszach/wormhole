import { describe, it, expect } from "vitest";

import type { VaultPayload } from "@/types.js";

import { encryptVault, decryptVault } from "./vault-crypto.js";

describe("vault crypto", () => {
	const password = "test-master-password";

	const vault: VaultPayload = {
		credentials: [
			{
				id: "1",
				label: "Personal Instagram",
				password: "s3cret!"
			},
			{
				id: "2",
				label: "GitHub",
				password: "gh-token-abc123"
			}
		]
	};

	it("round-trips encrypt then decrypt", async () => {
		const blob = await encryptVault(password, vault);
		const result = await decryptVault(password, blob);

		expect(result).toEqual(vault);
	});

	it("fails with wrong password", async () => {
		const blob = await encryptVault(password, vault);

		await expect(decryptVault("wrong-password", blob)).rejects.toThrow();
	});

	it("handles empty vault", async () => {
		const empty: VaultPayload = { credentials: [] };
		const blob = await encryptVault(password, empty);
		const result = await decryptVault(password, blob);

		expect(result).toEqual(empty);
	});

	it("produces different blobs for same input", async () => {
		const blob1 = await encryptVault(password, vault);
		const blob2 = await encryptVault(password, vault);

		const arr1 = new Uint8Array(blob1);
		const arr2 = new Uint8Array(blob2);

		// Salt and IV are random, so blobs should differ
		const same = arr1.every((byte, i) => byte === arr2[i]);
		expect(same).toBe(false);
	});

	it("blob has correct minimum size", async () => {
		const empty: VaultPayload = { credentials: [] };
		const blob = await encryptVault(password, empty);

		// salt (16) + iv (12) + at least some ciphertext + auth tag (16)
		expect(blob.byteLength).toBeGreaterThanOrEqual(16 + 12 + 16);
	});
});

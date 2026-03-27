import type { VaultPayload } from "@/types.js";

const PBKDF2_ITERATIONS = 600000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

async function deriveKey(
	password: string,
	salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveKey"]
	);

	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"]
	);
}

export async function encryptVault(
	password: string,
	vault: VaultPayload
): Promise<ArrayBuffer> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const key = await deriveKey(password, salt);

	const enc = new TextEncoder();
	const plaintext = enc.encode(JSON.stringify(vault));

	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		plaintext
	);

	// Format: salt (16) || iv (12) || ciphertext+tag
	const blob = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
	blob.set(salt, 0);
	blob.set(iv, SALT_BYTES);
	blob.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);

	return blob.buffer;
}

export async function decryptVault(
	password: string,
	blob: ArrayBuffer
): Promise<VaultPayload> {
	const data = new Uint8Array(blob);
	const salt = data.slice(0, SALT_BYTES);
	const iv = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
	const ciphertext = data.slice(SALT_BYTES + IV_BYTES);

	const key = await deriveKey(password, salt);

	const plaintext = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext
	);

	const dec = new TextDecoder();
	return JSON.parse(dec.decode(plaintext)) as VaultPayload;
}

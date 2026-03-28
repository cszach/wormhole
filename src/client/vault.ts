import type { VaultPayload } from "@/types.js";

import { encryptVault, decryptVault } from "./vault-crypto.js";

const VAULT_TIMEOUT_KEY = "wormhole-vault-timeout";
const VAULT_CLIP_TIMEOUT_KEY = "wormhole-vault-clip-timeout";
const autoLockMs = Number(localStorage.getItem(VAULT_TIMEOUT_KEY) ?? 300000);
const clipClearMs = Number(localStorage.getItem(VAULT_CLIP_TIMEOUT_KEY) ?? 30000);

let vaultData: VaultPayload | null = null;
let masterPassword: string | null = null;
let lockTimer = 0;
let ws: WebSocket | null = null;

function isSecureContext(): boolean {
	return (
		location.protocol === "https:" ||
		location.hostname === "localhost" ||
		location.hostname === "127.0.0.1"
	);
}

function resetLockTimer(): void {
	clearTimeout(lockTimer);
	if (autoLockMs > 0) {
		lockTimer = window.setTimeout(lock, autoLockMs);
	}
}

async function fetchVaultBlob(): Promise<ArrayBuffer | null> {
	const res = await fetch("/api/vault");

	if (res.status === 404) {
		return null;
	}
	if (!res.ok) {
		throw new Error("Failed to fetch vault");
	}

	return res.arrayBuffer();
}

async function saveVaultBlob(blob: ArrayBuffer): Promise<void> {
	const res = await fetch("/api/vault", {
		method: "PUT",
		headers: { "Content-Type": "application/octet-stream" },
		body: blob
	});

	if (!res.ok) {
		throw new Error("Failed to save vault");
	}
}

function lock(): void {
	vaultData = null;
	masterPassword = null;
	clearTimeout(lockTimer);
}

async function save(): Promise<void> {
	if (!masterPassword || !vaultData) {
		return;
	}

	const blob = await encryptVault(masterPassword, vaultData);
	await saveVaultBlob(blob);
}

export type VaultCommand = {
	label: string;
	onTerminal: () => void;
	onClipboard: () => void;
};

export function getVaultCommands(): VaultCommand[] {
	if (!vaultData || !ws) {
		return [];
	}

	return vaultData.credentials.map((cred) => ({
		label: cred.label,
		onTerminal: () => injectToTerminal(cred.password),
		onClipboard: () => copyToClipboard(cred.password)
	}));
}

function injectToTerminal(value: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	ws.send(JSON.stringify({ type: "vault-inject", value }));
}

function copyToClipboard(value: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	ws.send(
		JSON.stringify({ type: "vault-clipboard", value, clearMs: clipClearMs })
	);
}

export function getClipClearMs(): number {
	return clipClearMs;
}

export function isVaultUnlocked(): boolean {
	return vaultData !== null;
}

export function isVaultSecure(): boolean {
	return isSecureContext();
}

export async function unlockWithPassword(password: string): Promise<boolean> {
	try {
		const blob = await fetchVaultBlob();

		if (blob) {
			vaultData = await decryptVault(password, blob);
		} else {
			vaultData = { credentials: [] };
			const newBlob = await encryptVault(password, vaultData);
			await saveVaultBlob(newBlob);
		}

		masterPassword = password;
		resetLockTimer();

		return true;
	} catch {
		return false;
	}
}

export function initVault(websocket: WebSocket | null): void {
	ws = websocket;
}

export function updateVaultWs(websocket: WebSocket | null): void {
	ws = websocket;
}

export function lockVault(): void {
	lock();
}

export function getVaultCredentials(): { id: string; label: string }[] {
	if (!vaultData) {
		return [];
	}

	return vaultData.credentials.map((c) => ({ id: c.id, label: c.label }));
}

export async function addVaultCredential(
	label: string,
	password: string
): Promise<void> {
	if (!vaultData) {
		return;
	}

	vaultData.credentials.push({
		id: crypto.randomUUID(),
		label,
		password
	});

	await save();
	resetLockTimer();
}

export async function deleteVaultCredential(id: string): Promise<void> {
	if (!vaultData) {
		return;
	}

	vaultData.credentials = vaultData.credentials.filter((c) => c.id !== id);
	await save();
	resetLockTimer();
}

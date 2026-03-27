import type { VaultPayload } from "@/types.js";

import { encryptVault, decryptVault } from "./vault-crypto.js";

const VAULT_TIMEOUT_KEY = "wormhole-vault-timeout";
const VAULT_CLIP_TIMEOUT_KEY = "wormhole-vault-clip-timeout";
let autoLockMs = Number(localStorage.getItem(VAULT_TIMEOUT_KEY) ?? 300000);
let clipClearMs = Number(localStorage.getItem(VAULT_CLIP_TIMEOUT_KEY) ?? 30000);

let vaultData: VaultPayload | null = null;
let masterPassword: string | null = null;
let lockTimer = 0;
let ws: WebSocket | null = null;

const vaultLocked = document.getElementById("vault-locked") as HTMLElement;
const vaultUnlocked = document.getElementById("vault-unlocked") as HTMLElement;
const vaultPasswordInput = document.getElementById(
	"vault-password"
) as HTMLInputElement;
const vaultUnlockBtn = document.getElementById(
	"vault-unlock"
) as HTMLButtonElement;
const vaultError = document.getElementById("vault-error") as HTMLElement;
const vaultHttpsWarning = document.getElementById(
	"vault-https-warning"
) as HTMLElement;
const vaultList = document.getElementById("vault-list") as HTMLElement;
const vaultAddLabel = document.getElementById(
	"vault-add-label"
) as HTMLInputElement;
const vaultAddPassword = document.getElementById(
	"vault-add-password"
) as HTMLInputElement;
const vaultAddBtn = document.getElementById(
	"vault-add-btn"
) as HTMLButtonElement;
const vaultLockBtn = document.getElementById("vault-lock") as HTMLButtonElement;

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

	if (res.status === 404) {return null;}
	if (!res.ok) {throw new Error("Failed to fetch vault");}

	return res.arrayBuffer();
}

async function saveVaultBlob(blob: ArrayBuffer): Promise<void> {
	const res = await fetch("/api/vault", {
		method: "PUT",
		headers: { "Content-Type": "application/octet-stream" },
		body: blob
	});

	if (!res.ok) {throw new Error("Failed to save vault");}
}

async function unlock(): Promise<void> {
	const password = vaultPasswordInput.value;

	if (!password) {return;}

	vaultError.hidden = true;
	const ok = await unlockWithPassword(password);

	if (ok) {
		vaultPasswordInput.value = "";
	} else {
		vaultError.textContent = "Wrong password or corrupted vault.";
		vaultError.hidden = false;
	}
}

function lock(): void {
	vaultData = null;
	masterPassword = null;
	clearTimeout(lockTimer);
	vaultLocked.hidden = false;
	vaultUnlocked.hidden = true;
	vaultList.innerHTML = "";
	vaultError.hidden = true;
}

async function save(): Promise<void> {
	if (!masterPassword || !vaultData) {return;}

	const blob = await encryptVault(masterPassword, vaultData);
	await saveVaultBlob(blob);
}

function renderVaultList(): void {
	vaultList.innerHTML = "";

	if (!vaultData) {return;}

	for (const cred of vaultData.credentials) {
		const item = document.createElement("div");
		item.className = "vault-item";

		const label = document.createElement("div");
		label.className = "vault-item-label";
		label.textContent = cred.label;

		const del = document.createElement("button");
		del.className = "vault-item-btn vault-item-btn--danger";
		del.textContent = "\u00d7";
		del.title = "Delete";
		del.setAttribute("aria-label", "Delete credential");
		del.addEventListener("click", async () => {
			vaultData!.credentials = vaultData!.credentials.filter(
				(c) => c.id !== cred.id
			);
			await save();
			renderVaultList();
			resetLockTimer();
		});

		item.append(label, del);
		vaultList.appendChild(item);
	}
}

async function addCredential(): Promise<void> {
	const label = vaultAddLabel.value.trim();
	const password = vaultAddPassword.value;

	if (!label || !password || !vaultData) {return;}

	vaultData.credentials.push({
		id: crypto.randomUUID(),
		label,
		password
	});

	await save();
	renderVaultList();
	vaultAddLabel.value = "";
	vaultAddPassword.value = "";
	resetLockTimer();
}

export type VaultCommand = {
	label: string;
	onTerminal: () => void;
	onClipboard: () => void;
};

export function getVaultCommands(): VaultCommand[] {
	if (!vaultData || !ws) {return [];}

	return vaultData.credentials.map((cred) => ({
		label: cred.label,
		onTerminal: () => injectToTerminal(cred.password),
		onClipboard: () => copyToClipboard(cred.password)
	}));
}

function injectToTerminal(value: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {return;}

	ws.send(JSON.stringify({ type: "vault-inject", value }));
}

function copyToClipboard(value: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {return;}

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
		vaultLocked.hidden = true;
		vaultUnlocked.hidden = false;
		renderVaultList();
		resetLockTimer();

		return true;
	} catch {
		return false;
	}
}

async function resetVault(): Promise<void> {
	const confirmed = confirm(
		"This will permanently delete all stored credentials. This cannot be undone. Continue?"
	);

	if (!confirmed) {return;}

	try {
		await fetch("/api/vault", { method: "DELETE" });
	} catch {
		// Vault file may not exist
	}

	lock();
	vaultError.hidden = true;
}

export function initVault(websocket: WebSocket | null): void {
	ws = websocket;

	const vaultResetBtn = document.getElementById(
		"vault-reset"
	) as HTMLButtonElement;

	if (!isSecureContext()) {
		vaultHttpsWarning.hidden = false;
		vaultPasswordInput.hidden = true;
		vaultUnlockBtn.hidden = true;
		vaultResetBtn.hidden = true;

		return;
	}

	vaultUnlockBtn.addEventListener("click", unlock);

	vaultPasswordInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {unlock();}
	});

	vaultLockBtn.addEventListener("click", lock);
	vaultAddBtn.addEventListener("click", addCredential);
	vaultResetBtn.addEventListener("click", resetVault);

	const vaultTimeout = document.getElementById(
		"vault-timeout"
	) as HTMLSelectElement;
	vaultTimeout.value = String(autoLockMs);
	vaultTimeout.addEventListener("change", () => {
		autoLockMs = Number(vaultTimeout.value);
		localStorage.setItem(VAULT_TIMEOUT_KEY, String(autoLockMs));
		resetLockTimer();
	});

	const vaultLearnMore = document.getElementById(
		"vault-learn-more"
	) as HTMLAnchorElement;
	const vaultInfoModal = document.getElementById(
		"vault-info-modal"
	) as HTMLElement;
	const vaultInfoClose = document.getElementById(
		"vault-info-close"
	) as HTMLButtonElement;

	vaultLearnMore.addEventListener("click", (e) => {
		e.preventDefault();
		vaultInfoModal.hidden = false;
	});

	vaultInfoClose.addEventListener("click", () => {
		vaultInfoModal.hidden = true;
	});

	vaultInfoModal.addEventListener("click", (e) => {
		if (e.target === vaultInfoModal) {vaultInfoModal.hidden = true;}
	});

	const vaultClipTimeout = document.getElementById(
		"vault-clip-timeout"
	) as HTMLSelectElement;
	vaultClipTimeout.value = String(clipClearMs);
	vaultClipTimeout.addEventListener("change", () => {
		clipClearMs = Number(vaultClipTimeout.value);
		localStorage.setItem(VAULT_CLIP_TIMEOUT_KEY, String(clipClearMs));
	});
}

export function updateVaultWs(websocket: WebSocket | null): void {
	ws = websocket;
}

import {
	vdPanel,
	vdBackdrop,
	vdClose,
	vdLocked,
	vdUnlocked,
	vdPassword,
	vdUnlockBtn,
	vdResetBtn,
	vdHttpsWarning,
	vdList,
	vdSearch,
	vdAddToggle,
	vdAddModal,
	vdAddCancel,
	vdAddLabel,
	vdAddPassword,
	vdAddBtn,
	vdLockBtn
} from "./dom.js";
import { showToast } from "./toast.js";
import {
	isVaultSecure,
	isVaultUnlocked,
	unlockWithPassword,
	lockVault,
	getVaultCredentials,
	getVaultCommands,
	addVaultCredential,
	deleteVaultCredential,
	getClipClearMs
} from "./vault.js";

const TERM_SVG =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"' +
	' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
	' stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/>' +
	'<line x1="12" y1="19" x2="20" y2="19"/></svg>';

const CLIP_SVG =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"' +
	' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
	' stroke-linejoin="round"><rect x="2" y="3" width="20" height="14"' +
	' rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/>' +
	'<line x1="12" y1="17" x2="12" y2="21"/></svg>';

const DEL_SVG =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"' +
	' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
	' stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/>' +
	'<line x1="6" y1="6" x2="18" y2="18"/></svg>';

function syncView(): void {
	if (!isVaultSecure()) {
		vdHttpsWarning.hidden = false;
		vdPassword.hidden = true;
		vdUnlockBtn.hidden = true;
		vdResetBtn.hidden = true;
		vdLocked.hidden = false;
		vdUnlocked.hidden = true;
		vdSearch.disabled = true;
		vdAddToggle.disabled = true;
		vdAddModal.hidden = true;
		return;
	}

	vdHttpsWarning.hidden = true;

	if (isVaultUnlocked()) {
		vdLocked.hidden = true;
		vdUnlocked.hidden = false;
		vdSearch.disabled = false;
		vdAddToggle.disabled = false;
		vdSearch.value = "";
		renderCredentials("");
	} else {
		vdLocked.hidden = false;
		vdUnlocked.hidden = true;
		vdSearch.disabled = true;
		vdAddToggle.disabled = true;
		vdAddModal.hidden = true;
		vdPassword.hidden = false;
		vdUnlockBtn.hidden = false;
		vdResetBtn.hidden = false;
	}
}

function renderCredentials(filter: string): void {
	vdList.innerHTML = "";

	const commands = getVaultCommands();
	const credentials = getVaultCredentials();
	const lowerFilter = filter.toLowerCase();

	for (let i = 0; i < credentials.length; i++) {
		const cred = credentials[i];

		if (lowerFilter && !cred.label.toLowerCase().includes(lowerFilter)) {
			continue;
		}

		const cmd = commands[i];
		const row = document.createElement("div");
		row.className = "vd-cred";

		const label = document.createElement("span");
		label.className = "vd-cred-label";
		label.textContent = cred.label;

		const termBtn = document.createElement("button");
		termBtn.type = "button";
		termBtn.className = "vd-cred-btn";
		termBtn.title = "Paste to terminal";
		termBtn.setAttribute("aria-label", "Paste to terminal");
		termBtn.innerHTML = TERM_SVG;
		termBtn.addEventListener("click", () => {
			cmd.onTerminal();
			showToast("Pasted to terminal");
		});

		const clipBtn = document.createElement("button");
		clipBtn.type = "button";
		clipBtn.className = "vd-cred-btn";
		clipBtn.title = "Copy to remote clipboard";
		clipBtn.setAttribute("aria-label", "Copy to remote clipboard");
		clipBtn.innerHTML = CLIP_SVG;
		clipBtn.addEventListener("click", () => {
			cmd.onClipboard();
			const sec = getClipClearMs() / 1000;
			const clearLabel = sec > 0 ? ` \u2014 ${sec}s` : "";
			showToast(`Copied to remote clipboard${clearLabel}`);
		});

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "vd-cred-btn vd-cred-btn--danger";
		delBtn.title = "Delete";
		delBtn.setAttribute("aria-label", "Delete credential");
		delBtn.innerHTML = DEL_SVG;
		delBtn.addEventListener("click", async () => {
			await deleteVaultCredential(cred.id);
			renderCredentials(vdSearch.value);
		});

		row.append(label, termBtn, clipBtn, delBtn);
		vdList.appendChild(row);
	}

	if (vdList.children.length === 0) {
		const empty = document.createElement("div");
		empty.className = "fb-empty";
		empty.textContent = lowerFilter
			? "No credentials match"
			: "No credentials yet";
		vdList.appendChild(empty);
	}
}

async function doUnlock(): Promise<void> {
	const pw = vdPassword.value;
	if (!pw) {
		return;
	}

	const ok = await unlockWithPassword(pw);
	if (ok) {
		vdPassword.value = "";
		syncView();
	} else {
		vdPassword.value = "";
		vdPassword.placeholder = "Wrong password";
	}
}

async function doAdd(): Promise<void> {
	const label = vdAddLabel.value.trim();
	const password = vdAddPassword.value;

	if (!label || !password) {
		return;
	}

	await addVaultCredential(label, password);
	vdAddLabel.value = "";
	vdAddPassword.value = "";
	vdAddModal.hidden = true;
	renderCredentials(vdSearch.value);
}

async function doReset(): Promise<void> {
	const confirmed = confirm(
		"This will permanently delete all stored credentials. Continue?"
	);

	if (!confirmed) {
		return;
	}

	try {
		await fetch("/api/vault", { method: "DELETE" });
	} catch {
		// Vault file may not exist
	}

	lockVault();
	syncView();
}

export function openVaultDrawer(): void {
	vdPanel.hidden = false;
	syncView();
}

function closeVaultDrawer(): void {
	vdPanel.hidden = true;
	vdAddModal.hidden = true;
}

export function setupVaultDrawer(): void {
	vdClose.addEventListener("click", closeVaultDrawer);
	vdBackdrop.addEventListener("click", closeVaultDrawer);

	vdUnlockBtn.addEventListener("click", doUnlock);
	vdPassword.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			doUnlock();
		}
	});

	vdLockBtn.addEventListener("click", () => {
		lockVault();
		syncView();
	});

	vdSearch.addEventListener("input", () => {
		renderCredentials(vdSearch.value);
	});

	vdAddToggle.addEventListener("click", () => {
		vdAddLabel.value = "";
		vdAddPassword.value = "";
		vdAddModal.hidden = false;
		vdAddLabel.focus();
	});

	vdAddCancel.addEventListener("click", () => {
		vdAddModal.hidden = true;
	});

	vdAddModal.addEventListener("click", (e) => {
		if (e.target === vdAddModal) {
			vdAddModal.hidden = true;
		}
	});

	vdAddBtn.addEventListener("click", doAdd);
	vdAddPassword.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			doAdd();
		}
	});

	vdResetBtn.addEventListener("click", doReset);
}

import { state } from "./state.js";
import {
	textInput,
	sendBtn,
	imageInput,
	fileInput,
	imageBtn,
	filePreviews,
	modOverlay,
	modComboLabel,
	modInput,
	modCancel
} from "./dom.js";
import { syncFooterPadding } from "./layout.js";

// --- Draft management ---

const DRAFT_KEY = "wormhole-draft";
const DRAFT_DEBOUNCE_MS = 500;
let draftTimer = 0;

function saveDraft(): void {
	clearTimeout(draftTimer);
	draftTimer = window.setTimeout(() => {
		const val = textInput.value;
		if (val) {
			localStorage.setItem(DRAFT_KEY, val);
		} else {
			localStorage.removeItem(DRAFT_KEY);
		}
	}, DRAFT_DEBOUNCE_MS);
}

export function clearDraft(): void {
	clearTimeout(draftTimer);
	localStorage.removeItem(DRAFT_KEY);
}

export function restoreDraft(): void {
	const draft = localStorage.getItem(DRAFT_KEY);
	if (draft && !textInput.value) {
		textInput.value = draft;
		textInput.style.height = "auto";
		textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
		syncFooterPadding();
	}
}

// --- File upload ---

let attachedFilePaths: string[] = [];

const REMOVE_SVG =
	'<svg viewBox="0 0 16 16" width="10" height="10" fill="none"' +
	' stroke="currentColor" stroke-width="2.5">' +
	'<line x1="4" y1="4" x2="12" y2="12"/>' +
	'<line x1="12" y1="4" x2="4" y2="12"/></svg>';

function addPreviewItem(
	serverPath: string,
	file: File,
	blobUrl: string | null
): void {
	const wrapper = document.createElement("div");
	wrapper.className = "preview-thumb";

	if (file.type.startsWith("image/") && blobUrl) {
		const img = document.createElement("img");
		img.src = blobUrl;
		img.alt = "Attached image";
		img.width = 52;
		img.height = 52;
		wrapper.appendChild(img);
	} else {
		const fileEl = document.createElement("div");
		fileEl.className = "preview-file";
		fileEl.innerHTML =
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none"' +
			' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
			' stroke-linejoin="round">' +
			'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
			'<polyline points="14 2 14 8 20 8"/></svg>';
		const name = document.createElement("span");
		name.className = "preview-file-name";
		name.textContent = file.name;
		name.title = file.name;
		fileEl.appendChild(name);
		wrapper.appendChild(fileEl);
	}

	const removeBtn = document.createElement("button");
	removeBtn.className = "remove-thumb";
	removeBtn.title = "Remove file";
	removeBtn.setAttribute("aria-label", "Remove file");
	removeBtn.innerHTML = REMOVE_SVG;

	removeBtn.addEventListener("click", () => {
		attachedFilePaths = attachedFilePaths.filter((p) => p !== serverPath);
		if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
		}
		wrapper.remove();
		syncFooterPadding();
	});

	wrapper.appendChild(removeBtn);
	filePreviews.appendChild(wrapper);
	syncFooterPadding();
}

export function clearFiles(): void {
	attachedFilePaths = [];

	for (const img of Array.from(filePreviews.querySelectorAll("img"))) {
		URL.revokeObjectURL(img.src);
	}

	filePreviews.innerHTML = "";
	syncFooterPadding();
}

// --- Send ---

export function send(): void {
	if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
		return;
	}

	const text = textInput.value.trim();

	if (!text && attachedFilePaths.length === 0) {
		return;
	}

	state.ws.send(
		JSON.stringify({
			type: "send",
			text,
			filePaths: attachedFilePaths.length > 0 ? attachedFilePaths : undefined
		})
	);

	textInput.value = "";
	textInput.style.height = "auto";
	state.prevInputLen = 0;
	clearDraft();
	clearFiles();

	if (!state.inClaudeCode) {
		textInput.focus();
	}
}

// --- Modifier key overlay ---

const activeMods = new Set<string>();

function updateModLabel(): void {
	const parts = Array.from(activeMods).map((mod) => {
		if (mod === "C") {
			return "Ctrl";
		}
		if (mod === "M") {
			return "Alt";
		}
		if (mod === "S") {
			return "Shift";
		}

		return mod;
	});

	modComboLabel.textContent = parts.join(" + ") + " +";
}

function openModOverlay(): void {
	updateModLabel();
	modOverlay.hidden = false;
	modInput.value = "";
	modInput.focus();
	syncFooterPadding();
}

function closeModOverlay(): void {
	activeMods.clear();
	modOverlay.hidden = true;

	for (const btn of Array.from(
		document.querySelectorAll<HTMLButtonElement>(".key-btn--mod")
	)) {
		btn.classList.remove("active");
	}

	syncFooterPadding();
}

// --- Setup ---

export function setupInputHandlers(): void {
	// Send button
	sendBtn.addEventListener("click", () => {
		navigator.vibrate?.(15);
		send();
	});

	// Key buttons
	for (const btn of Array.from(
		document.querySelectorAll<HTMLButtonElement>(
			".key-btn[data-key], .key-btn[data-raw]"
		)
	)) {
		btn.addEventListener("click", () => {
			navigator.vibrate?.(15);

			if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
				return;
			}

			const { key, raw } = btn.dataset;

			if (key) {
				state.ws.send(JSON.stringify({ type: "key", key }));
			} else if (raw) {
				state.ws.send(JSON.stringify({ type: "key", key: raw }));
			}
		});
	}

	// Textarea auto-resize + draft save
	textInput.addEventListener("input", () => {
		textInput.style.height = "auto";
		textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
		syncFooterPadding();
		saveDraft();
	});

	// Image button short tap opens image picker
	imageBtn.addEventListener("click", () => {
		imageInput.click();
	});

	// Shared upload handler for both inputs
	async function handleFileUpload(input: HTMLInputElement): Promise<void> {
		const { files } = input;

		if (!files || files.length === 0) {
			return;
		}

		for (const file of Array.from(files)) {
			const formData = new FormData();
			formData.append("file", file);

			try {
				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData
				});

				const data = await response.json();
				const blobUrl = file.type.startsWith("image/")
					? URL.createObjectURL(file)
					: null;

				attachedFilePaths.push(data.path);
				addPreviewItem(data.path, file, blobUrl);
			} catch {
				// Upload failed silently
			}
		}

		input.value = "";
	}

	imageInput.addEventListener("change", () => handleFileUpload(imageInput));
	fileInput.addEventListener("change", () => handleFileUpload(fileInput));

	// Modifier key buttons
	for (const modBtn of Array.from(
		document.querySelectorAll<HTMLButtonElement>(".key-btn--mod")
	)) {
		modBtn.addEventListener("click", () => {
			navigator.vibrate?.(15);
			const mod = modBtn.dataset.mod!;

			if (activeMods.has(mod)) {
				activeMods.delete(mod);
				modBtn.classList.remove("active");

				if (activeMods.size === 0) {
					closeModOverlay();

					return;
				}

				updateModLabel();
			} else {
				activeMods.add(mod);
				modBtn.classList.add("active");
				openModOverlay();
			}
		});
	}

	// Modifier input
	modInput.addEventListener("input", () => {
		const ch = modInput.value;

		if (!ch || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const prefix = Array.from(activeMods).join("-");
		const key = prefix + "-" + ch;

		state.ws.send(JSON.stringify({ type: "key", key }));
		closeModOverlay();
	});

	modCancel.addEventListener("click", () => {
		closeModOverlay();
	});

	modInput.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeModOverlay();
		}
	});
}

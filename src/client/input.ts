import { state } from "./state.js";
import {
	textInput,
	sendBtn,
	imageInput,
	imageBtn,
	imagePreviews,
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

// --- Image upload ---

let attachedImagePaths: string[] = [];

function addPreviewThumbnail(serverPath: string, blobUrl: string): void {
	const wrapper = document.createElement("div");
	wrapper.className = "preview-thumb";

	const img = document.createElement("img");
	img.src = blobUrl;
	img.alt = "Attached image";
	img.width = 52;
	img.height = 52;

	const removeBtn = document.createElement("button");
	removeBtn.className = "remove-thumb";
	removeBtn.title = "Remove image";
	removeBtn.setAttribute("aria-label", "Remove image");
	removeBtn.innerHTML =
		'<svg viewBox="0 0 16 16" width="10" height="10" fill="none"' +
		' stroke="currentColor" stroke-width="2.5">' +
		'<line x1="4" y1="4" x2="12" y2="12"/>' +
		'<line x1="12" y1="4" x2="4" y2="12"/></svg>';

	removeBtn.addEventListener("click", () => {
		attachedImagePaths = attachedImagePaths.filter((p) => p !== serverPath);

		URL.revokeObjectURL(blobUrl);
		wrapper.remove();
		syncFooterPadding();
	});

	wrapper.appendChild(img);
	wrapper.appendChild(removeBtn);
	imagePreviews.appendChild(wrapper);
	syncFooterPadding();
}

export function clearImages(): void {
	attachedImagePaths = [];

	for (const img of Array.from(imagePreviews.querySelectorAll("img"))) {
		URL.revokeObjectURL(img.src);
	}

	imagePreviews.innerHTML = "";
	syncFooterPadding();
}

// --- Send ---

export function send(): void {
	if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
		return;
	}

	const text = textInput.value.trim();

	if (!text && attachedImagePaths.length === 0) {
		return;
	}

	state.ws.send(
		JSON.stringify({
			type: "send",
			text,
			imagePaths: attachedImagePaths.length > 0 ? attachedImagePaths : undefined
		})
	);

	textInput.value = "";
	textInput.style.height = "auto";
	state.prevInputLen = 0;
	clearDraft();
	clearImages();

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

	// Image upload
	imageBtn.addEventListener("click", () => {
		imageInput.click();
	});

	imageInput.addEventListener("change", async () => {
		const { files } = imageInput;

		if (!files || files.length === 0) {
			return;
		}

		for (const file of Array.from(files)) {
			const formData = new FormData();
			formData.append("image", file);

			try {
				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData
				});

				const data = await response.json();
				const blobUrl = URL.createObjectURL(file);

				attachedImagePaths.push(data.path);
				addPreviewThumbnail(data.path, blobUrl);
			} catch {
				// Upload failed silently
			}
		}

		imageInput.value = "";
	});

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

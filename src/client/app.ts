import { AnsiUp } from "ansi_up";
import {
	createIcons,
	ArrowRightToLine,
	Bookmark,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	CornerDownLeft,
	Ellipsis,
	Image,
	Mic,
	Search,
	RefreshCw,
	Send,
	Settings,
	Signal,
	X
} from "lucide";

import { isClaudeCode, getTTSText } from "@/text-processing.js";
import { getDefaultTheme, getTheme, themes } from "@/themes/index.js";

import {
	initVault,
	updateVaultWs,
	getVaultCommands,
	isVaultUnlocked,
	isVaultSecure,
	unlockWithPassword,
	getClipClearMs
} from "./vault.js";
import { initShader } from "./shader.js";

type ServerMessage =
	| { type: "output"; content: string }
	| { type: "stable" }
	| { type: "session"; session: string }
	| { type: "pong"; ts: number }
	| { type: "bg-stable"; session: string }
	| { type: "bg-clear"; session: string }
	| { type: "vault-inject-ack"; success: boolean }
	| { type: "vault-clipboard-ack"; success: boolean };

const PING_INTERVAL_MS = 15000;
const PING_HISTORY_SIZE = 3;
const PING_GOOD_MS = 50;
const PING_WARN_MS = 150;

const pingHistory: number[] = [];
let latencyMs = -1;

function getAvgLatency(): number {
	if (pingHistory.length === 0) {
		return -1;
	}
	return Math.round(
		pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length
	);
}

function recordPing(rtt: number): void {
	pingHistory.push(rtt);
	if (pingHistory.length > PING_HISTORY_SIZE) {
		pingHistory.shift();
	}
	latencyMs = getAvgLatency();
	updateDotColor();
}

function updateDotColor(): void {
	wsDot.classList.remove("ping-good", "ping-warn", "ping-poor");
	if (latencyMs < 0) {
		return;
	}

	if (latencyMs <= PING_GOOD_MS) {
		wsDot.classList.add("ping-good");
	} else if (latencyMs <= PING_WARN_MS) {
		wsDot.classList.add("ping-warn");
	} else {
		wsDot.classList.add("ping-poor");
	}
}

function sendPing(): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
	}
}

const wsDot = document.getElementById("ws-dot") as HTMLElement;
const sessionNameEl = document.getElementById("session-name") as HTMLElement;
const sessionHint = document.getElementById("session-hint") as HTMLElement;
const wormholingEl = document.getElementById("wormholing") as HTMLElement;
const wormholingHint = document.getElementById(
	"wormholing-hint"
) as HTMLElement;
let wormholingTimer = 0;
const WORMHOLING_HINT_MS = 8000;

const toastEl = document.getElementById("toast") as HTMLElement;
let toastTimer = 0;

function showToast(message: string): void {
	clearTimeout(toastTimer);
	toastEl.textContent = message;
	toastEl.hidden = false;
	requestAnimationFrame(() => toastEl.classList.add("visible"));
	toastTimer = window.setTimeout(() => {
		toastEl.classList.remove("visible");
		setTimeout(() => {
			toastEl.hidden = true;
		}, 200);
	}, 2000);
}

const readySessions = new Set<string>();

function updateSessionHint(): void {
	const count = readySessions.size;

	if (count === 0) {
		sessionHint.textContent = "Tap to switch";
		sessionHint.classList.remove("has-ready");
	} else {
		const label =
			count === 1 ? "1 other session ready" : `${count} other sessions ready`;
		sessionHint.textContent = label;
		sessionHint.classList.add("has-ready");
	}
}
const output = document.getElementById("output") as HTMLElement;
const textInput = document.getElementById("text-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const micBtn = document.getElementById("mic-btn") as HTMLButtonElement;
const ttsToggle = document.getElementById("tts-toggle") as HTMLInputElement;
const imageInput = document.getElementById("image-input") as HTMLInputElement;
const imagePreviews = document.getElementById("image-previews") as HTMLElement;
const settingsBtn = document.getElementById(
	"settings-btn"
) as HTMLButtonElement;
const settingsPanel = document.getElementById("settings-panel") as HTMLElement;
const settingsClose = document.getElementById(
	"settings-close"
) as HTMLButtonElement;
const settingsBackdrop = settingsPanel.querySelector(
	".settings-backdrop"
) as HTMLElement;
const themeList = document.getElementById("theme-list") as HTMLElement;

const ansi = new AnsiUp();

let ws: WebSocket | null = null;
let ttsEnabled = false;
let attachedImagePaths: string[] = [];
let autoScroll = true;
let recognition: SpeechRecognition | null = null;
let isRecording = false;
let rawOutput = "";

const RECONNECT_DELAY_MS = 500;

function connect(): void {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	ws = new WebSocket(`${protocol}//${location.host}`);

	let pingTimer = 0;

	ws.addEventListener("open", () => {
		wsDot.classList.add("connected");
		updateVaultWs(ws);
		updateColumns();
		sendPing();
		pingTimer = window.setInterval(sendPing, PING_INTERVAL_MS);
	});

	ws.addEventListener("message", (event) => {
		const message: ServerMessage = JSON.parse(event.data);

		if (message.type === "output") {
			rawOutput = message.content;
			renderOutput(message.content);
			wormholingEl.hidden = true;
			wormholingHint.classList.remove("visible");
			clearTimeout(wormholingTimer);
		}

		if (message.type === "stable" && ttsEnabled) {
			speakLatest();
		}

		if (message.type === "session") {
			sessionNameEl.textContent = message.session;
			output.innerHTML = "";
			rawOutput = "";
			wormholingEl.hidden = false;
			wormholingHint.classList.remove("visible");
			clearTimeout(wormholingTimer);
			wormholingTimer = window.setTimeout(() => {
				if (!wormholingEl.hidden) {
					wormholingHint.classList.add("visible");
				}
			}, WORMHOLING_HINT_MS);
		}

		if (message.type === "pong") {
			recordPing(Date.now() - message.ts);
		}

		if (message.type === "bg-stable") {
			readySessions.add(message.session);
			updateSessionHint();
		}

		if (message.type === "bg-clear") {
			readySessions.delete(message.session);
			updateSessionHint();
		}
	});

	ws.addEventListener("close", () => {
		wsDot.classList.remove("connected");
		wsDot.classList.remove("ping-good", "ping-warn", "ping-poor");
		clearInterval(pingTimer);
		pingHistory.length = 0;
		latencyMs = -1;
		readySessions.clear();
		updateSessionHint();
		setTimeout(() => {
			connect();
		}, RECONNECT_DELAY_MS);
	});
}

let rerunSearch: () => void = () => {};

let inClaudeCode = false;
const ccKeys = document.getElementById("cc-keys") as HTMLElement;
const termKeys = document.getElementById("term-keys") as HTMLElement;

const imageBtn = document.getElementById("image-btn") as HTMLElement;
const snippetsBtn = document.getElementById(
	"snippets-btn"
) as HTMLButtonElement;

function syncKeyLayout(): void {
	ccKeys.hidden = !inClaudeCode;
	termKeys.hidden = inClaudeCode;
	imageBtn.classList.toggle("disabled", !inClaudeCode);
	imageBtn.hidden = !inClaudeCode;
	snippetsBtn.hidden = inClaudeCode;

	if (inClaudeCode) {
		textInput.removeAttribute("autocomplete");
		textInput.removeAttribute("autocorrect");
		textInput.setAttribute("autocapitalize", "sentences");
	} else {
		textInput.setAttribute("autocomplete", "off");
		textInput.setAttribute("autocorrect", "off");
		textInput.setAttribute("autocapitalize", "off");
	}
}

function renderOutput(content: string): void {
	const wasCC = inClaudeCode;
	inClaudeCode = isClaudeCode(content);

	if (inClaudeCode !== wasCC) {
		syncKeyLayout();
		syncFooterPadding();
	}

	const html = ansi.ansi_to_html(content);
	const lines = html.split("\n");

	output.innerHTML = lines.map((l) => `<div>${l || "&nbsp;"}</div>`).join("");

	rerunSearch();

	if (autoScroll) {
		output.scrollTop = output.scrollHeight;
	}
}

const scrollBtn = document.getElementById("scroll-btn") as HTMLButtonElement;

output.addEventListener("scroll", () => {
	const thresholdPx = 50;
	const distanceFromBottom =
		output.scrollHeight - output.scrollTop - output.clientHeight;

	autoScroll = distanceFromBottom < thresholdPx;
	scrollBtn.hidden = autoScroll;
});

scrollBtn.addEventListener("click", () => {
	output.scrollTop = output.scrollHeight;
	autoScroll = true;
	scrollBtn.hidden = true;
});

function send(): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	const text = textInput.value.trim();

	if (!text && attachedImagePaths.length === 0) {
		return;
	}

	ws.send(
		JSON.stringify({
			type: "send",
			text,
			imagePaths: attachedImagePaths.length > 0 ? attachedImagePaths : undefined
		})
	);

	textInput.value = "";
	textInput.style.height = "auto";
	prevInputLen = 0;
	clearDraft();
	clearImages();

	if (!inClaudeCode) {
		textInput.focus();
	}
}

sendBtn.addEventListener("click", () => {
	navigator.vibrate?.(15);
	send();
});

// Enter inserts newline (default textarea behavior).
// Send only via the send button.

for (const btn of Array.from(
	document.querySelectorAll<HTMLButtonElement>(
		".key-btn[data-key], .key-btn[data-raw]"
	)
)) {
	btn.addEventListener("click", () => {
		navigator.vibrate?.(15);

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const { key, raw } = btn.dataset;

		if (key) {
			ws.send(JSON.stringify({ type: "key", key }));
		} else if (raw) {
			ws.send(JSON.stringify({ type: "key", key: raw }));
		}
	});
}

const footer = document.querySelector("footer") as HTMLElement;

function syncFooterPadding(): void {
	requestAnimationFrame(() => {
		output.style.paddingBottom = footer.offsetHeight + 16 + "px";
		scrollBtn.style.bottom = footer.offsetHeight + 16 + "px";
		saveSnippetBtn.style.bottom = footer.offsetHeight + 12 + "px";
		toastEl.style.bottom = footer.offsetHeight + 12 + "px";
	});
}

let inputFocusedBeforeExpand = false;

for (const expandBtn of Array.from(
	document.querySelectorAll<HTMLButtonElement>(".keys-expand")
)) {
	expandBtn.addEventListener("pointerdown", () => {
		inputFocusedBeforeExpand = document.activeElement === textInput;
	});

	expandBtn.addEventListener("click", () => {
		const layout = expandBtn.closest(".key-layout") as HTMLElement;
		const extraRows = layout.querySelectorAll<HTMLElement>(".key-row--extra");
		const anyVisible = Array.from(extraRows).some((r) => !r.hidden);

		for (const row of Array.from(extraRows)) {
			row.hidden = anyVisible;
		}

		expandBtn.classList.toggle("active", !anyVisible);
		syncFooterPadding();

		if (inputFocusedBeforeExpand) {
			textInput.focus();
		}
	});
}

const modOverlay = document.getElementById("mod-overlay") as HTMLElement;
const modComboLabel = document.getElementById("mod-combo-label") as HTMLElement;
const modInput = document.getElementById("mod-input") as HTMLInputElement;
const modCancel = document.getElementById("mod-cancel") as HTMLButtonElement;
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

modInput.addEventListener("input", () => {
	const ch = modInput.value;

	if (!ch || !ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	// Build tmux key: C-S-x, M-a, etc.
	const prefix = Array.from(activeMods).join("-");
	const key = prefix + "-" + ch;

	ws.send(JSON.stringify({ type: "key", key }));
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

// Auto-resize textarea

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

function clearDraft(): void {
	clearTimeout(draftTimer);
	localStorage.removeItem(DRAFT_KEY);
}

function restoreDraft(): void {
	const draft = localStorage.getItem(DRAFT_KEY);
	if (draft && !textInput.value) {
		textInput.value = draft;
		textInput.style.height = "auto";
		textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
		syncFooterPadding();
	}
}

textInput.addEventListener("input", () => {
	textInput.style.height = "auto";
	textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
	syncFooterPadding();
	saveDraft();
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

function clearImages(): void {
	attachedImagePaths = [];

	for (const img of Array.from(imagePreviews.querySelectorAll("img"))) {
		URL.revokeObjectURL(img.src);
	}

	imagePreviews.innerHTML = "";
	syncFooterPadding();
}

function initSpeechRecognition(): void {
	const SpeechRecognition =
		window.SpeechRecognition || window.webkitSpeechRecognition;

	if (!SpeechRecognition) {
		micBtn.title = "Speech recognition not supported";
		micBtn.style.opacity = "0.3";

		return;
	}

	recognition = new SpeechRecognition();
	recognition.continuous = false;
	recognition.interimResults = false;
	recognition.lang = "en-US";

	recognition.addEventListener("result", ((event: SpeechRecognitionEvent) => {
		const { transcript } = event.results[0][0];

		if (textInput.value && !textInput.value.endsWith(" ")) {
			textInput.value += " ";
		}

		textInput.value += transcript;
		textInput.style.height = "auto";
		textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
	}) as EventListener);

	recognition.addEventListener("end", () => {
		if (isRecording) {
			recognition?.start();
		}
	});

	recognition.addEventListener("error", () => {
		stopRecording();
	});

	micBtn.addEventListener("click", () => {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	});
}

function startRecording(): void {
	if (!recognition) {
		return;
	}

	isRecording = true;
	micBtn.classList.add("recording");
	recognition.start();
}

function stopRecording(): void {
	isRecording = false;
	micBtn.classList.remove("recording");
	recognition?.stop();
}

ttsToggle.addEventListener("change", () => {
	ttsEnabled = ttsToggle.checked;

	if (!ttsEnabled) {
		speechSynthesis.cancel();
	}
});

function speakLatest(): void {
	const ttsMode = localStorage.getItem("wormhole-tts-mode") ?? "summary";
	const snippet = getTTSText(rawOutput, ttsMode);

	if (!snippet) {
		return;
	}

	speechSynthesis.cancel();

	const utterance = new SpeechSynthesisUtterance(snippet);
	utterance.rate = ttsRate;

	const savedVoice = localStorage.getItem("wormhole-tts-voice");

	if (savedVoice) {
		const voice = speechSynthesis
			.getVoices()
			.find((v) => v.name === savedVoice);

		if (voice) {
			utterance.voice = voice;
		}
	}

	speechSynthesis.speak(utterance);
}

const savedThemeId = localStorage.getItem("wormhole-theme");
const initialTheme =
	(savedThemeId && getTheme(savedThemeId)) || getDefaultTheme();

const canvas = document.getElementById("bg-shader") as HTMLCanvasElement;

let shaderEngine: ReturnType<typeof initShader> = null;

let activeThemeId = initialTheme.id;

function applyTheme(id: string): void {
	const theme = getTheme(id);

	if (!theme) {
		return;
	}

	if (shaderEngine) {
		shaderEngine.setTheme(theme);
	}

	activeThemeId = theme.id;
	localStorage.setItem("wormhole-theme", theme.id);
	renderThemeList();
}

const ttsModeSelect = document.getElementById("tts-mode") as HTMLSelectElement;
const ttsRateInput = document.getElementById("tts-rate") as HTMLInputElement;
const ttsRateValue = document.getElementById("tts-rate-value") as HTMLElement;
const ttsVoiceSelect = document.getElementById(
	"tts-voice"
) as HTMLSelectElement;
const colorList = document.getElementById("color-list") as HTMLElement;

const ACCENT_COLORS = [
	{ name: "Lavender", value: "#c4b1f5" },
	{ name: "Cyan", value: "#38bdf8" },
	{ name: "Emerald", value: "#4ade80" },
	{ name: "Rose", value: "#f472b6" },
	{ name: "Amber", value: "#fbbf24" },
	{ name: "Coral", value: "#fb7185" },
	{ name: "Teal", value: "#2dd4bf" },
	{ name: "White", value: "#e4e4e7" }
];

let ttsRate = parseFloat(localStorage.getItem("wormhole-tts-rate") ?? "1.1");
let activeAccent = localStorage.getItem("wormhole-accent") ?? "#c4b1f5";

function applyAccentColor(hex: string): void {
	const root = document.documentElement;
	root.style.setProperty("--accent", hex);

	// Compute a dim version for backgrounds
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	root.style.setProperty("--accent-dim", `rgba(${r}, ${g}, ${b}, 0.08)`);

	activeAccent = hex;
	localStorage.setItem("wormhole-accent", hex);
}

function openSettings(): void {
	settingsPanel.hidden = false;
	renderThemeList();
	renderColorList();
	populateVoices();
	ttsModeSelect.value = localStorage.getItem("wormhole-tts-mode") ?? "summary";
	ttsRateInput.value = String(ttsRate);
	ttsRateValue.textContent = ttsRate.toFixed(1) + "x";
	ttsToggle.checked = ttsEnabled;
	renderSkillChips();
	renderSnippetList();
}

function closeSettings(): void {
	settingsPanel.hidden = true;
}

settingsBtn.addEventListener("click", () => {
	openSettings();
});

settingsClose.addEventListener("click", () => {
	closeSettings();
});

settingsBackdrop.addEventListener("click", () => {
	closeSettings();
});

// Theme list

function renderThemeList(): void {
	themeList.innerHTML = "";

	for (const theme of themes) {
		const btn = document.createElement("button");
		btn.className = "theme-option";

		if (theme.id === activeThemeId) {
			btn.classList.add("active");
		}

		const dot = document.createElement("span");
		dot.className = "theme-dot";

		const label = document.createElement("span");
		label.textContent = theme.name;

		btn.appendChild(dot);
		btn.appendChild(label);

		btn.addEventListener("click", () => {
			applyTheme(theme.id);
		});

		themeList.appendChild(btn);
	}
}

// Color list

function renderColorList(): void {
	colorList.innerHTML = "";

	for (const color of ACCENT_COLORS) {
		const btn = document.createElement("button");
		btn.className = "color-swatch";
		btn.title = color.name;
		btn.setAttribute("aria-label", color.name);

		if (color.value === activeAccent) {
			btn.classList.add("active");
		}

		const inner = document.createElement("span");
		inner.className = "color-swatch-inner";
		inner.style.background = color.value;

		btn.appendChild(inner);

		btn.addEventListener("click", () => {
			applyAccentColor(color.value);
			renderColorList();
		});

		colorList.appendChild(btn);
	}
}

// TTS mode

ttsModeSelect.addEventListener("change", () => {
	localStorage.setItem("wormhole-tts-mode", ttsModeSelect.value);
});

// TTS rate

ttsRateInput.addEventListener("input", () => {
	ttsRate = parseFloat(ttsRateInput.value);
	ttsRateValue.textContent = ttsRate.toFixed(1) + "x";
	localStorage.setItem("wormhole-tts-rate", String(ttsRate));
});

// TTS voice

function populateVoices(): void {
	const voices = speechSynthesis.getVoices();
	const saved = localStorage.getItem("wormhole-tts-voice") ?? "";

	ttsVoiceSelect.innerHTML = '<option value="">System Default</option>';

	for (const voice of voices) {
		const opt = document.createElement("option");
		opt.value = voice.name;
		opt.textContent = voice.name + (voice.lang ? ` (${voice.lang})` : "");

		if (voice.name === saved) {
			opt.selected = true;
		}

		ttsVoiceSelect.appendChild(opt);
	}
}

speechSynthesis.addEventListener("voiceschanged", populateVoices);

ttsVoiceSelect.addEventListener("change", () => {
	localStorage.setItem("wormhole-tts-voice", ttsVoiceSelect.value);
});

// Skills (chip input)

const skillsChips = document.getElementById("skills-chips") as HTMLElement;
const skillsAdd = document.getElementById("skills-add") as HTMLInputElement;

function getSkills(): string[] {
	const raw = localStorage.getItem("wormhole-skills") ?? "";

	return raw
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);
}

function saveSkills(skills: string[]): void {
	localStorage.setItem("wormhole-skills", skills.join("\n"));
}

function renderSkillChips(): void {
	skillsChips.innerHTML = "";

	for (const skill of getSkills()) {
		const chip = document.createElement("span");
		chip.className = "chip";

		const label = document.createElement("span");
		label.textContent = skill;

		const remove = document.createElement("button");
		remove.className = "chip-remove";
		remove.textContent = "\u00D7";
		remove.setAttribute("aria-label", "Remove " + skill);

		remove.addEventListener("click", () => {
			const skills = getSkills().filter((s) => s !== skill);
			saveSkills(skills);
			renderSkillChips();
		});

		chip.appendChild(label);
		chip.appendChild(remove);
		skillsChips.appendChild(chip);
	}
}

skillsAdd.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();

		const val = skillsAdd.value.trim();

		if (!val) {
			return;
		}

		const skills = getSkills();

		if (!skills.includes(val)) {
			skills.push(val);
			saveSkills(skills);
			renderSkillChips();
		}

		skillsAdd.value = "";
	}
});

function getSnippets(): string[] {
	try {
		return JSON.parse(localStorage.getItem("wormhole-snippets") ?? "[]");
	} catch {
		return [];
	}
}

function saveSnippets(snippets: string[]): void {
	localStorage.setItem("wormhole-snippets", JSON.stringify(snippets));
}

function addSnippet(text: string): void {
	const snippets = getSnippets();

	if (!snippets.includes(text)) {
		snippets.push(text);
		saveSnippets(snippets);
	}
}

const snippetsList = document.getElementById("snippets-list") as HTMLElement;
const snippetsAdd = document.getElementById("snippets-add") as HTMLInputElement;

function renderSnippetList(): void {
	snippetsList.innerHTML = "";

	for (const snippet of getSnippets()) {
		const row = document.createElement("div");
		row.className = "snippet-item";

		const label = document.createElement("span");
		label.className = "snippet-item-text";
		label.textContent = snippet.replace(/\n/g, " ");
		label.title = snippet;

		const del = document.createElement("button");
		del.className = "session-delete";
		del.textContent = "\u00d7";
		del.title = "Remove snippet";
		del.setAttribute("aria-label", "Remove snippet");

		del.addEventListener("click", () => {
			const snippets = getSnippets().filter((s) => s !== snippet);
			saveSnippets(snippets);
			renderSnippetList();
		});

		row.appendChild(label);
		row.appendChild(del);
		snippetsList.appendChild(row);
	}
}

snippetsAdd.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();

		const val = snippetsAdd.value.trim();

		if (!val) {
			return;
		}

		addSnippet(val);
		renderSnippetList();
		snippetsAdd.value = "";
	}
});

const saveSnippetBtn = document.getElementById(
	"save-snippet-btn"
) as HTMLButtonElement;

document.addEventListener("selectionchange", () => {
	const sel = window.getSelection();
	const text = sel?.toString().trim() ?? "";

	if (text && output.contains(sel?.anchorNode ?? null)) {
		saveSnippetBtn.hidden = false;
	} else {
		saveSnippetBtn.hidden = true;
	}
});

function extractSelectionWithNewlines(): string {
	const sel = window.getSelection();

	if (!sel || sel.rangeCount === 0) {
		return "";
	}

	const range = sel.getRangeAt(0);
	const fragment = range.cloneContents();
	const divs = fragment.querySelectorAll("div");

	if (divs.length > 0) {
		return Array.from(divs)
			.map((d) => d.textContent ?? "")
			.join("\n")
			.trim();
	}

	return sel.toString().trim();
}

saveSnippetBtn.addEventListener("click", () => {
	const text = extractSelectionWithNewlines();
	const sel = window.getSelection();

	if (text) {
		addSnippet(text);
		sel?.removeAllRanges();
		saveSnippetBtn.hidden = true;
	}
});

type Command = {
	name: string;
	desc: string;
	section: string;
};

const BUILTIN_COMMANDS: Command[] = [
	{ name: "/help", desc: "Show help", section: "Built-in" },
	{ name: "/compact", desc: "Compact conversation", section: "Built-in" },
	{ name: "/context", desc: "Show context usage", section: "Built-in" },
	{ name: "/clear", desc: "Clear conversation", section: "Built-in" },
	{ name: "/cost", desc: "Show token costs", section: "Built-in" },
	{ name: "/memory", desc: "Edit memory", section: "Built-in" },
	{ name: "/mcp", desc: "MCP server status", section: "Built-in" },
	{ name: "/skills", desc: "List skills", section: "Built-in" },
	{ name: "/config", desc: "Show config", section: "Built-in" }
];

function getSkillCommands(): Command[] {
	return getSkills().map((s) => ({
		name: "/" + s,
		desc: "",
		section: "Skills"
	}));
}

function getSnippetCommands(): Command[] {
	return getSnippets().map((s) => ({
		name: s,
		desc: "",
		section: "Snippets"
	}));
}

const cmdPalette = document.getElementById("cmd-palette") as HTMLElement;
const cmdList = document.getElementById("cmd-list") as HTMLElement;
const cmdSearch = document.getElementById("cmd-search") as HTMLInputElement;
const cmdClose = document.getElementById("cmd-close") as HTMLButtonElement;
const cmdBackdrop = cmdPalette.querySelector(".cmd-backdrop") as HTMLElement;

let cmdSnippetsOnly = false;

function renderCommandList(filter: string): void {
	cmdList.innerHTML = "";

	const vaultCmds = getVaultCommands();
	const allCommands = cmdSnippetsOnly
		? getSnippetCommands()
		: [...BUILTIN_COMMANDS, ...getSkillCommands(), ...getSnippetCommands()];
	const lowerFilter = filter.toLowerCase();
	const filtered = lowerFilter
		? allCommands.filter(
				(c) =>
					c.name.toLowerCase().includes(lowerFilter) ||
					c.desc.toLowerCase().includes(lowerFilter)
			)
		: allCommands;

	const filteredVault = lowerFilter
		? vaultCmds.filter((v) => v.label.toLowerCase().includes(lowerFilter))
		: vaultCmds;

	let currentSection = "";

	for (const cmd of filtered) {
		if (cmd.section !== currentSection) {
			currentSection = cmd.section;

			const label = document.createElement("div");
			label.className = "cmd-section-label";
			label.textContent = currentSection;
			cmdList.appendChild(label);
		}

		const btn = document.createElement("button");
		btn.className = "cmd-item";

		const name = document.createElement("span");
		name.textContent = cmd.name;

		const desc = document.createElement("span");
		desc.className = "cmd-item-desc";
		desc.textContent = cmd.desc;

		btn.appendChild(name);
		btn.appendChild(desc);

		btn.addEventListener("click", () => {
			textInput.value = cmd.section === "Snippets" ? cmd.name : cmd.name + " ";
			textInput.focus();
			textInput.style.height = "auto";
			textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
			closeCmdPalette();
		});

		cmdList.appendChild(btn);
	}

	if (!cmdSnippetsOnly && isVaultSecure() && !isVaultUnlocked()) {
		const vaultLabel = document.createElement("div");
		vaultLabel.className = "cmd-section-label";
		vaultLabel.textContent = "Vault";
		cmdList.appendChild(vaultLabel);

		const unlockRow = document.createElement("div");
		unlockRow.className = "cmd-vault-unlock";

		const pwInput = document.createElement("input");
		pwInput.type = "password";
		pwInput.className = "cmd-vault-password";
		pwInput.placeholder = "Master password\u2026";
		pwInput.setAttribute("aria-label", "Master password");
		pwInput.autocomplete = "off";

		const unlockBtn = document.createElement("button");
		unlockBtn.className = "cmd-vault-unlock-btn";
		unlockBtn.textContent = "Unlock";

		const doUnlock = async () => {
			if (!pwInput.value) {return;}
			const ok = await unlockWithPassword(pwInput.value);
			if (ok) {
				renderCommandList(filter);
			} else {
				pwInput.value = "";
				pwInput.placeholder = "Wrong password";
			}
		};

		unlockBtn.addEventListener("click", doUnlock);
		pwInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {doUnlock();}
		});

		unlockRow.append(pwInput, unlockBtn);
		cmdList.appendChild(unlockRow);
	}

	if (filteredVault.length > 0) {
		const vaultLabel = document.createElement("div");
		vaultLabel.className = "cmd-section-label";
		vaultLabel.textContent = "Vault";
		cmdList.appendChild(vaultLabel);

		for (const vcmd of filteredVault) {
			const row = document.createElement("div");
			row.className = "cmd-vault-item";

			const name = document.createElement("span");
			name.className = "cmd-vault-label";
			name.textContent = vcmd.label;

			const actions = document.createElement("div");
			actions.className = "cmd-vault-actions";

			const termBtn = document.createElement("button");
			termBtn.className = "cmd-vault-btn";
			termBtn.title = "Paste to terminal";
			termBtn.setAttribute("aria-label", "Paste to terminal");
			termBtn.innerHTML =
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
			termBtn.addEventListener("click", () => {
				vcmd.onTerminal();
				closeCmdPalette();
				showToast("Pasted to terminal");
			});

			const clipBtn = document.createElement("button");
			clipBtn.className = "cmd-vault-btn";
			clipBtn.title = "Copy to remote clipboard";
			clipBtn.setAttribute("aria-label", "Copy to remote clipboard");
			clipBtn.innerHTML =
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
			clipBtn.addEventListener("click", () => {
				vcmd.onClipboard();
				closeCmdPalette();
				const clearSec = getClipClearMs() / 1000;
				const clearLabel = clearSec > 0 ? ` \u2014 ${clearSec}s` : "";
				showToast(`Copied to remote clipboard${clearLabel}`);
			});

			actions.append(termBtn, clipBtn);
			row.append(name, actions);
			cmdList.appendChild(row);
		}
	}

	if (filtered.length === 0 && filteredVault.length === 0) {
		const empty = document.createElement("div");
		empty.className = "cmd-section-label";
		empty.textContent = "No commands found";
		cmdList.appendChild(empty);
	}
}

function openCmdPalette(snippetsOnly = false): void {
	cmdSnippetsOnly = snippetsOnly;
	cmdPalette.hidden = false;
	cmdSearch.value = "";
	renderCommandList("");
	cmdSearch.focus();
}

function closeCmdPalette(): void {
	cmdPalette.hidden = true;
	textInput.focus();
}

cmdClose.addEventListener("click", () => {
	closeCmdPalette();
});

cmdBackdrop.addEventListener("click", () => {
	closeCmdPalette();
});

cmdSearch.addEventListener("input", () => {
	renderCommandList(cmdSearch.value);
});

// Open palette when user types / as first character (not backspace, Claude Code only)
let prevInputLen = 0;

textInput.addEventListener("input", () => {
	const len = textInput.value.length;

	if (textInput.value === "/" && len > prevInputLen && inClaudeCode) {
		openCmdPalette();
	}

	prevInputLen = len;
});

// Terminal columns

const autoColsCheckbox = document.getElementById(
	"auto-cols"
) as HTMLInputElement;
const colsRow = document.getElementById("cols-row") as HTMLElement;
const colsSlider = document.getElementById("cols-slider") as HTMLInputElement;
const colsValue = document.getElementById("cols-value") as HTMLElement;

function calculateColumns(): number {
	const outputEl = document.getElementById("output")!;
	const style = getComputedStyle(outputEl);
	const fontSize = parseFloat(style.fontSize);

	// Approximate char width for monospace at this font size
	const charWidth = fontSize * 0.6;
	const padding =
		parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
	const available = outputEl.clientWidth - padding;

	// Subtract scrollbar width buffer for consistency
	return Math.floor((available - 6) / charWidth);
}

function sendResize(cols: number): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	ws.send(JSON.stringify({ type: "resize", cols }));
}

function updateColumns(): void {
	const isAuto = autoColsCheckbox.checked;

	colsRow.classList.toggle("disabled", isAuto);

	if (isAuto) {
		const cols = calculateColumns();
		colsSlider.value = String(cols);
		colsValue.textContent = String(cols);
		sendResize(cols);
		localStorage.setItem("wormhole-auto-cols", "true");
	} else {
		const cols = parseInt(colsSlider.value);
		sendResize(cols);
		localStorage.setItem("wormhole-auto-cols", "false");
		localStorage.setItem("wormhole-cols", String(cols));
	}
}

autoColsCheckbox.addEventListener("change", () => {
	updateColumns();
});

colsSlider.addEventListener("input", () => {
	colsValue.textContent = colsSlider.value;
});

colsSlider.addEventListener("change", () => {
	localStorage.setItem("wormhole-cols", colsSlider.value);
	sendResize(parseInt(colsSlider.value));
});

// Recalculate on resize when auto is enabled (debounced)
const RESIZE_DEBOUNCE_MS = 1000;
let resizeTimer = 0;

window.addEventListener("resize", () => {
	if (autoColsCheckbox.checked) {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			updateColumns();
		}, RESIZE_DEBOUNCE_MS);
	}
});

try {
	shaderEngine = initShader(canvas, initialTheme);
} catch (err) {
	console.error("initShader failed:", err);
}

applyAccentColor(activeAccent);

try {
	createIcons({
		icons: {
			ArrowRightToLine,
			Bookmark,
			ChevronDown,
			ChevronLeft,
			ChevronRight,
			ChevronUp,
			CornerDownLeft,
			Ellipsis,
			Image,
			Mic,
			Search,
			RefreshCw,
			Send,
			Settings,
			Signal,
			X
		}
	});
} catch (err) {
	console.error("createIcons failed:", err);
}

try {
	clearImages();
} catch (err) {
	console.error("clearImages failed:", err);
}

// Restore draft
restoreDraft();
initVault(ws);

// Restore column settings
const savedAutoCols = localStorage.getItem("wormhole-auto-cols");

if (savedAutoCols === "false") {
	autoColsCheckbox.checked = false;
	const savedCols = localStorage.getItem("wormhole-cols") ?? "80";
	colsSlider.value = savedCols;
	colsValue.textContent = savedCols;
	colsRow.classList.remove("disabled");
} else {
	autoColsCheckbox.checked = true;
	colsRow.classList.add("disabled");
}

const sessionBtn = document.getElementById("session-btn") as HTMLButtonElement;
const sessionModal = document.getElementById("session-modal") as HTMLElement;
const sessionList = document.getElementById("session-list") as HTMLElement;
const sessionNewName = document.getElementById(
	"session-new-name"
) as HTMLInputElement;
const sessionCreateBtn = document.getElementById(
	"session-create-btn"
) as HTMLButtonElement;
const sessionError = document.getElementById("session-error") as HTMLElement;
const modalPing = document.getElementById("modal-ping") as HTMLElement;
const modalPingValue = document.getElementById(
	"modal-ping-value"
) as HTMLElement;

async function fetchSessions(): Promise<string[]> {
	try {
		const res = await fetch("/api/sessions");
		const data = await res.json();

		return data.sessions ?? [];
	} catch {
		return [];
	}
}

function renderSessionList(sessions: string[]): void {
	sessionList.innerHTML = "";
	const current = sessionNameEl.textContent ?? "";
	const canDelete = sessions.length > 1;

	for (const name of sessions) {
		const row = document.createElement("div");
		row.className = "session-item";

		if (name === current) {
			row.classList.add("active");
		}

		if (readySessions.has(name)) {
			const dot = document.createElement("span");
			dot.className = "session-ready-dot";
			row.appendChild(dot);
		}

		const label = document.createElement("button");
		label.className = "session-item-name";
		label.textContent = name;

		label.addEventListener("click", () => {
			if (name !== current && ws && ws.readyState === WebSocket.OPEN) {
				readySessions.delete(name);
				updateSessionHint();
				ws.send(JSON.stringify({ type: "switch", session: name }));
			}

			closeSessionModal();
		});

		row.appendChild(label);

		const del = document.createElement("button");
		del.className = "session-delete";
		del.textContent = "\u00d7";
		del.title = "Delete session";
		del.setAttribute("aria-label", "Delete session");
		del.disabled = !canDelete;

		del.addEventListener("click", async (event) => {
			event.stopPropagation();

			try {
				const res = await fetch("/api/sessions/" + encodeURIComponent(name), {
					method: "DELETE"
				});

				if (!res.ok) {
					const data = await res.json();
					sessionError.textContent = data.error ?? "Failed to delete";
					sessionError.hidden = false;

					return;
				}

				const updated = await fetchSessions();
				renderSessionList(updated);
			} catch {
				sessionError.textContent = "Failed to delete session";
				sessionError.hidden = false;
			}
		});

		row.appendChild(del);
		sessionList.appendChild(row);
	}
}

async function openSessionModal(): Promise<void> {
	sessionError.hidden = true;
	sessionNewName.value = "";
	sessionModal.hidden = false;

	if (latencyMs >= 0) {
		modalPingValue.textContent = `${latencyMs}ms`;
		modalPing.classList.remove("ping-good", "ping-warn", "ping-poor");
		if (latencyMs <= PING_GOOD_MS) {
			modalPing.classList.add("ping-good");
		} else if (latencyMs <= PING_WARN_MS) {
			modalPing.classList.add("ping-warn");
		} else {
			modalPing.classList.add("ping-poor");
		}
		modalPing.hidden = false;
	} else {
		modalPing.hidden = true;
	}

	const sessions = await fetchSessions();
	renderSessionList(sessions);
}

function closeSessionModal(): void {
	sessionModal.hidden = true;
}

sessionBtn.addEventListener("click", () => {
	openSessionModal();
});

sessionModal.addEventListener("click", (event) => {
	if (event.target === sessionModal) {
		closeSessionModal();
	}
});

document
	.getElementById("wormholing-refresh")!
	.addEventListener("click", (e) => {
		e.preventDefault();
		location.reload();
	});

const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;
refreshBtn.addEventListener("click", () => {
	location.reload();
});

sessionCreateBtn.addEventListener("click", async () => {
	const name = sessionNewName.value.trim();

	if (!name) {
		return;
	}

	sessionError.hidden = true;

	try {
		const res = await fetch("/api/sessions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name })
		});

		if (!res.ok) {
			const data = await res.json();
			sessionError.textContent = data.error ?? "Failed to create session";
			sessionError.hidden = false;

			return;
		}

		// Auto-switch to new session
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "switch", session: name }));
		}

		closeSessionModal();
	} catch {
		sessionError.textContent = "Failed to create session";
		sessionError.hidden = false;
	}
});

sessionNewName.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		sessionCreateBtn.click();
	}
});

const searchBtn = document.getElementById("search-btn") as HTMLButtonElement;
const searchBar = document.getElementById("search-bar") as HTMLElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchCount = document.getElementById("search-count") as HTMLElement;
const searchPrev = document.getElementById("search-prev") as HTMLButtonElement;
const searchNext = document.getElementById("search-next") as HTMLButtonElement;

let searchMatches: Element[] = [];
let searchIndex = -1;

function clearSearch(): void {
	const marks = output.querySelectorAll("mark.search-hit");

	for (const m of Array.from(marks)) {
		const text = document.createTextNode(m.textContent ?? "");
		m.parentNode?.replaceChild(text, m);
	}

	output.normalize();
	searchMatches = [];
	searchIndex = -1;
	searchCount.textContent = "";
}

function doSearch(query: string): void {
	clearSearch();

	if (!query) {
		return;
	}

	const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let node: Text | null;

	while ((node = walker.nextNode() as Text | null)) {
		textNodes.push(node);
	}

	const lowerQuery = query.toLowerCase();

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const lower = text.toLowerCase();
		let idx = lower.indexOf(lowerQuery);

		if (idx === -1) {
			continue;
		}

		const frag = document.createDocumentFragment();
		let lastIdx = 0;

		while (idx !== -1) {
			if (idx > lastIdx) {
				frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
			}

			const mark = document.createElement("mark");
			mark.className = "search-hit";
			mark.textContent = text.slice(idx, idx + query.length);
			frag.appendChild(mark);
			lastIdx = idx + query.length;
			idx = lower.indexOf(lowerQuery, lastIdx);
		}

		if (lastIdx < text.length) {
			frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		}

		textNode.parentNode?.replaceChild(frag, textNode);
	}

	searchMatches = Array.from(output.querySelectorAll("mark.search-hit"));

	if (searchMatches.length > 0) {
		searchIndex = 0;
		searchMatches[0].classList.add("search-active");
		searchMatches[0].scrollIntoView({ block: "center" });
		searchCount.textContent = `1/${searchMatches.length}`;
	} else {
		searchCount.textContent = "0";
	}
}

function navigateSearch(dir: number): void {
	if (searchMatches.length === 0) {
		return;
	}

	searchMatches[searchIndex].classList.remove("search-active");
	searchIndex =
		(searchIndex + dir + searchMatches.length) % searchMatches.length;
	searchMatches[searchIndex].classList.add("search-active");
	searchMatches[searchIndex].scrollIntoView({ block: "center" });
	searchCount.textContent = `${searchIndex + 1}/${searchMatches.length}`;
}

function openSearch(): void {
	searchBar.hidden = false;
	searchInput.value = "";
	searchInput.focus();
}

function closeSearch(): void {
	searchBar.hidden = true;
	clearSearch();
}

rerunSearch = () => {
	if (!searchBar.hidden && searchInput.value) {
		doSearch(searchInput.value);
	}
};

searchBtn.addEventListener("click", () => {
	if (searchBar.hidden) {
		openSearch();
	} else {
		closeSearch();
	}
});

searchInput.addEventListener("input", () => {
	doSearch(searchInput.value);
});

searchPrev.addEventListener("click", () => {
	navigateSearch(-1);
});

searchNext.addEventListener("click", () => {
	navigateSearch(1);
});

searchInput.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeSearch();
	} else if (event.key === "Enter") {
		navigateSearch(event.shiftKey ? -1 : 1);
	}
});

snippetsBtn.addEventListener("click", () => {
	openCmdPalette(true);
});

syncKeyLayout();
syncFooterPadding();
connect();
initSpeechRecognition();

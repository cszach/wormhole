import { AnsiUp } from "ansi_up";
import {
	createIcons,
	ChevronDown,
	ChevronUp,
	CornerDownLeft,
	Image,
	Mic,
	RefreshCw,
	Send,
	Settings,
	Volume2,
	VolumeOff,
	X
} from "lucide";

import {
	extractMode as extractModeFromContent,
	stripChrome,
	getTTSText
} from "@/text-processing.js";
import { getDefaultTheme, getTheme, themes } from "@/themes/index.js";

import { initShader } from "./shader.js";

type ServerMessage = { type: "output"; content: string } | { type: "stable" };

const wsStatus = document.getElementById("ws-status") as HTMLElement;
const output = document.getElementById("output") as HTMLElement;
const textInput = document.getElementById("text-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const micBtn = document.getElementById("mic-btn") as HTMLButtonElement;
const ttsToggle = document.getElementById("tts-toggle") as HTMLButtonElement;
const modeBtn = document.getElementById("mode-btn") as HTMLButtonElement;
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

// --- WebSocket ---

function connect(): void {
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	ws = new WebSocket(`${protocol}//${location.host}`);

	ws.addEventListener("open", () => {
		wsStatus.classList.add("connected");
		wsStatus.title = "Connected";
		wsStatus.querySelector(".ws-label")!.textContent = "Live";

		// Apply terminal column width on connect
		updateColumns();
	});

	ws.addEventListener("message", (event) => {
		const message: ServerMessage = JSON.parse(event.data);

		if (message.type === "output") {
			rawOutput = message.content;
			renderOutput(message.content);
		}

		if (message.type === "stable" && ttsEnabled) {
			speakLatest();
		}
	});

	ws.addEventListener("close", () => {
		wsStatus.classList.remove("connected");
		wsStatus.title = "Disconnected";
		wsStatus.querySelector(".ws-label")!.textContent = "Offline";
		setTimeout(() => {
			connect();
		}, 2000);
	});
}

// --- Output rendering ---

const modeLabel = document.getElementById("mode-label") as HTMLElement;

function updateMode(content: string): void {
	modeLabel.textContent = extractModeFromContent(content);
}

function renderOutput(content: string): void {
	updateMode(content);
	const stripped = stripChrome(content);
	const html = ansi.ansi_to_html(stripped);
	output.innerHTML = html;

	if (autoScroll) {
		output.scrollTop = output.scrollHeight;
	}
}

output.addEventListener("scroll", () => {
	const threshold = 50;
	const distanceFromBottom =
		output.scrollHeight - output.scrollTop - output.clientHeight;

	autoScroll = distanceFromBottom < threshold;
});

// --- Send message ---

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
	clearImages();
}

sendBtn.addEventListener("click", () => {
	send();
});

// Enter inserts newline (default textarea behavior).
// Send only via the send button.

// --- Key buttons (mode cycle, arrows, enter) ---

modeBtn.addEventListener("click", () => {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	ws.send(JSON.stringify({ type: "key", key: "BTab" }));
});

for (const btn of Array.from(
	document.querySelectorAll<HTMLButtonElement>(".key-btn")
)) {
	btn.addEventListener("click", () => {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const {key} = btn.dataset;

		if (key) {
			ws.send(JSON.stringify({ type: "key", key }));
		}
	});
}

// Auto-resize textarea

textInput.addEventListener("input", () => {
	textInput.style.height = "auto";
	textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
});

// --- Image upload ---

imageInput.addEventListener("change", async () => {
	const {files} = imageInput;

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
	});

	wrapper.appendChild(img);
	wrapper.appendChild(removeBtn);
	imagePreviews.appendChild(wrapper);
}

function clearImages(): void {
	attachedImagePaths = [];

	for (const img of Array.from(imagePreviews.querySelectorAll("img"))) {
		URL.revokeObjectURL(img.src);
	}

	imagePreviews.innerHTML = "";
}

// --- Voice dictation (Web Speech API) ---

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

	recognition.addEventListener("result", (event) => {
		const {transcript} = event.results[0][0];

		if (textInput.value && !textInput.value.endsWith(" ")) {
			textInput.value += " ";
		}

		textInput.value += transcript;
		textInput.style.height = "auto";
		textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
	});

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

// --- TTS ---

ttsToggle.addEventListener("click", () => {
	ttsEnabled = !ttsEnabled;
	ttsToggle.classList.toggle("active", ttsEnabled);

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

// --- Theme system ---

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

// --- Settings panel ---

const ttsModeSelect = document.getElementById("tts-mode") as HTMLSelectElement;
const ttsRateInput = document.getElementById("tts-rate") as HTMLInputElement;
const ttsRateValue = document.getElementById("tts-rate-value") as HTMLElement;
const ttsVoiceSelect = document.getElementById(
	"tts-voice"
) as HTMLSelectElement;
const tmuxSessionInput = document.getElementById(
	"tmux-session"
) as HTMLInputElement;
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
	tmuxSessionInput.value = localStorage.getItem("wormhole-tmux-session") ?? "";
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

// tmux session

tmuxSessionInput.addEventListener("change", () => {
	const val = tmuxSessionInput.value.trim();
	localStorage.setItem("wormhole-tmux-session", val);
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
let resizeTimer = 0;

window.addEventListener("resize", () => {
	if (autoColsCheckbox.checked) {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			updateColumns();
		}, 1000);
	}
});

// --- Init ---

try {
	shaderEngine = initShader(canvas, initialTheme);
} catch (e) {
	console.error("initShader failed:", e);
}

applyAccentColor(activeAccent);

try {
	createIcons({
		icons: {
			ChevronDown,
			ChevronUp,
			CornerDownLeft,
			Image,
			Mic,
			RefreshCw,
			Send,
			Settings,
			Volume2,
			VolumeOff,
			X
		}
	});
} catch (e) {
	console.error("createIcons failed:", e);
}

try {
	clearImages();
} catch (e) {
	console.error("clearImages failed:", e);
}

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

connect();
initSpeechRecognition();

// Declare Web Speech API types for TypeScript

declare global {
	type SpeechRecognition = {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		start(): void;
		stop(): void;
		addEventListener(
			type: string,
			listener: (event: SpeechRecognitionEvent) => void
		): void;
	};

	type SpeechRecognitionEvent = {
		resultIndex: number;
		results: SpeechRecognitionResultList;
	};

	type SpeechRecognitionResultList = {
		length: number;
		[index: number]: SpeechRecognitionResult;
	};

	type SpeechRecognitionResult = {
		isFinal: boolean;
		[index: number]: SpeechRecognitionAlternative;
	};

	type SpeechRecognitionAlternative = {
		transcript: string;
		confidence: number;
	};

	 
	var SpeechRecognition: {
		new (): SpeechRecognition;
	};
	var webkitSpeechRecognition: {
		new (): SpeechRecognition;
	};
	 

	type Window = {
		SpeechRecognition?: typeof SpeechRecognition;
		webkitSpeechRecognition?: typeof webkitSpeechRecognition;
	};
}

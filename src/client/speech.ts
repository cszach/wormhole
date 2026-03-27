import { getTTSText } from "@/text-processing.js";

import { state } from "./state.js";
import {
	micBtn,
	textInput,
	ttsToggle,
	ttsModeSelect,
	ttsRateInput,
	ttsRateValue,
	ttsVoiceSelect
} from "./dom.js";

let recognition: SpeechRecognition | null = null;
let isRecording = false;

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

export function speakLatest(): void {
	const ttsMode = localStorage.getItem("wormhole-tts-mode") ?? "summary";
	const snippet = getTTSText(state.rawOutput, ttsMode);

	if (!snippet) {
		return;
	}

	speechSynthesis.cancel();

	const utterance = new SpeechSynthesisUtterance(snippet);
	utterance.rate = state.ttsRate;

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

export function populateVoices(): void {
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

export function initSpeechRecognition(): void {
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

export function setupTtsSettings(): void {
	ttsToggle.addEventListener("change", () => {
		state.ttsEnabled = ttsToggle.checked;

		if (!state.ttsEnabled) {
			speechSynthesis.cancel();
		}
	});

	ttsModeSelect.addEventListener("change", () => {
		localStorage.setItem("wormhole-tts-mode", ttsModeSelect.value);
	});

	ttsRateInput.addEventListener("input", () => {
		state.ttsRate = parseFloat(ttsRateInput.value);
		ttsRateValue.textContent = state.ttsRate.toFixed(1) + "x";
		localStorage.setItem("wormhole-tts-rate", String(state.ttsRate));
	});

	ttsVoiceSelect.addEventListener("change", () => {
		localStorage.setItem("wormhole-tts-voice", ttsVoiceSelect.value);
	});

	speechSynthesis.addEventListener("voiceschanged", populateVoices);
}

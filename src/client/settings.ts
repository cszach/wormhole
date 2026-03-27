import { state } from "./state.js";
import {
	settingsBtn,
	settingsPanel,
	settingsClose,
	settingsBackdrop,
	ttsToggle,
	ttsModeSelect,
	ttsRateInput,
	ttsRateValue
} from "./dom.js";
import { renderThemeList, renderColorList } from "./theme.js";
import { populateVoices } from "./speech.js";
import { renderSkillChips } from "./skills.js";
import { renderSnippetList } from "./snippets.js";

function openSettings(): void {
	settingsPanel.hidden = false;
	renderThemeList();
	renderColorList();
	populateVoices();
	ttsModeSelect.value = localStorage.getItem("wormhole-tts-mode") ?? "summary";
	ttsRateInput.value = String(state.ttsRate);
	ttsRateValue.textContent = state.ttsRate.toFixed(1) + "x";
	ttsToggle.checked = state.ttsEnabled;
	renderSkillChips();
	renderSnippetList();
}

function closeSettings(): void {
	settingsPanel.hidden = true;
}

export function setupSettingsHandlers(): void {
	settingsBtn.addEventListener("click", () => {
		openSettings();
	});

	settingsClose.addEventListener("click", () => {
		closeSettings();
	});

	settingsBackdrop.addEventListener("click", () => {
		closeSettings();
	});
}

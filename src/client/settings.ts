import { state } from "./state.js";
import {
	settingsBtn,
	settingsPanel,
	settingsClose,
	settingsBackdrop,
	ttsToggle,
	ttsModeSelect,
	ttsRateInput,
	ttsRateValue,
	fvTabWidth,
	fvSubtext,
	fvWrap,
	vaultLockTimeout,
	vaultClipTimeout
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
	fvTabWidth.value = localStorage.getItem("wormhole-fv-tab-width") ?? "4";
	fvSubtext.value = localStorage.getItem("wormhole-fv-subtext") ?? "size";
	fvWrap.checked =
		(localStorage.getItem("wormhole-fv-wrap") ?? "true") === "true";
	vaultLockTimeout.value =
		localStorage.getItem("wormhole-vault-timeout") ?? "300000";
	vaultClipTimeout.value =
		localStorage.getItem("wormhole-vault-clip-timeout") ?? "30000";
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

	fvTabWidth.addEventListener("change", () => {
		localStorage.setItem("wormhole-fv-tab-width", fvTabWidth.value);
	});

	fvSubtext.addEventListener("change", () => {
		localStorage.setItem("wormhole-fv-subtext", fvSubtext.value);
	});

	fvWrap.addEventListener("change", () => {
		localStorage.setItem("wormhole-fv-wrap", String(fvWrap.checked));
	});

	vaultLockTimeout.addEventListener("change", () => {
		localStorage.setItem("wormhole-vault-timeout", vaultLockTimeout.value);
	});

	vaultClipTimeout.addEventListener("change", () => {
		localStorage.setItem("wormhole-vault-clip-timeout", vaultClipTimeout.value);
	});
}

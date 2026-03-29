import { AnsiUp } from "ansi_up";

import { isClaudeCode } from "@/text-processing.js";

import { state } from "./state.js";
import { output } from "./dom.js";
import { syncKeyLayout, syncFooterPadding } from "./layout.js";
import { linkifyOutput } from "./linkify.js";

const ansi = new AnsiUp();

let rerunSearch: () => void = () => {};

export function setRerunSearch(fn: () => void): void {
	rerunSearch = fn;
}

export function relinkify(): void {
	linkifyOutput();
}

export function renderOutput(content: string): void {
	const wasCC = state.inClaudeCode;
	state.inClaudeCode = isClaudeCode(content);

	if (state.inClaudeCode !== wasCC) {
		syncKeyLayout();
		syncFooterPadding();
	}

	const html = ansi.ansi_to_html(content);
	const lines = html.split("\n");

	output.innerHTML = lines.map((l) => `<div>${l || "&nbsp;"}</div>`).join("");

	linkifyOutput();
	rerunSearch();
	syncFooterPadding();

	if (state.autoScroll) {
		output.scrollTop = output.scrollHeight;
	}
}

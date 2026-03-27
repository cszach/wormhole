import { state } from "./state.js";
import {
	footer,
	scrollBtn,
	saveSnippetBtn,
	toastEl,
	ccKeys,
	termKeys,
	imageBtn,
	snippetsBtn,
	textInput,
	output
} from "./dom.js";

export function syncFooterPadding(): void {
	const h = footer.offsetHeight;
	scrollBtn.style.bottom = h + 16 + "px";
	saveSnippetBtn.style.bottom = h + 12 + "px";
	toastEl.style.bottom = h + 12 + "px";
}

export function syncKeyLayout(): void {
	ccKeys.hidden = !state.inClaudeCode;
	termKeys.hidden = state.inClaudeCode;
	imageBtn.classList.toggle("disabled", !state.inClaudeCode);
	imageBtn.hidden = !state.inClaudeCode;
	snippetsBtn.hidden = state.inClaudeCode;

	if (state.inClaudeCode) {
		textInput.removeAttribute("autocomplete");
		textInput.removeAttribute("autocorrect");
		textInput.setAttribute("autocapitalize", "sentences");
	} else {
		textInput.setAttribute("autocomplete", "off");
		textInput.setAttribute("autocorrect", "off");
		textInput.setAttribute("autocapitalize", "off");
	}
}

export function setupScrollHandlers(): void {
	output.addEventListener("scroll", () => {
		const thresholdPx = 50;
		const distanceFromBottom =
			output.scrollHeight - output.scrollTop - output.clientHeight;

		state.autoScroll = distanceFromBottom < thresholdPx;
		scrollBtn.hidden = state.autoScroll;
	});

	scrollBtn.addEventListener("click", () => {
		output.scrollTop = output.scrollHeight;
		state.autoScroll = true;
		scrollBtn.hidden = true;
	});
}

export function setupFooterObserver(): void {
	new ResizeObserver(() => syncFooterPadding()).observe(footer);
}

export function setupKeyExpand(): void {
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
}

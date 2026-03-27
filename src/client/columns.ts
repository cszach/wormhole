import { state } from "./state.js";
import { autoColsCheckbox, colsRow, colsSlider, colsValue } from "./dom.js";

const RESIZE_DEBOUNCE_MS = 1000;
let resizeTimer = 0;

function calculateColumns(): number {
	const outputEl = document.getElementById("output")!;
	const style = getComputedStyle(outputEl);
	const fontSize = parseFloat(style.fontSize);

	const charWidth = fontSize * 0.6;
	const padding =
		parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
	const available = outputEl.clientWidth - padding;

	return Math.floor((available - 6) / charWidth);
}

function sendResize(cols: number): void {
	if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
		return;
	}

	state.ws.send(JSON.stringify({ type: "resize", cols }));
}

export function updateColumns(): void {
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

export function restoreColumnSettings(): void {
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
}

export function setupColumnHandlers(): void {
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

	window.addEventListener("resize", () => {
		if (autoColsCheckbox.checked) {
			clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				updateColumns();
			}, RESIZE_DEBOUNCE_MS);
		}
	});
}

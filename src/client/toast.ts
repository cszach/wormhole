import { toastEl } from "./dom.js";

let toastTimer = 0;

export function showToast(message: string): void {
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

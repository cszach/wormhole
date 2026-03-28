import { state } from "./state.js";
import {
	imageBtn,
	snippetsBtn,
	fileInput,
	powerMenu,
	powerAttach,
	powerVault,
	powerBrowse
} from "./dom.js";
import { openFileBrowser } from "./file-browser.js";
import { openVaultDrawer } from "./vault-drawer.js";

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;
let pressTimer = 0;
let suppressClick = false;
let startX = 0;
let startY = 0;

function openMenu(): void {
	powerAttach.hidden = !state.inClaudeCode;
	powerMenu.hidden = false;
}

function closeMenu(): void {
	powerMenu.hidden = true;
}

function cancelPress(): void {
	clearTimeout(pressTimer);
}

function attachLongPress(btn: HTMLElement): void {
	btn.addEventListener(
		"click",
		(e) => {
			if (suppressClick) {
				e.stopImmediatePropagation();
				e.preventDefault();
				suppressClick = false;
			}
		},
		{ capture: true }
	);

	btn.addEventListener("pointerdown", (e) => {
		if (e.button !== 0) {
			return;
		}

		startX = e.clientX;
		startY = e.clientY;
		suppressClick = false;

		pressTimer = window.setTimeout(() => {
			suppressClick = true;
			navigator.vibrate?.(15);
			openMenu();
		}, LONG_PRESS_MS);
	});

	btn.addEventListener("pointerup", cancelPress);
	btn.addEventListener("pointercancel", cancelPress);

	btn.addEventListener("pointermove", (e) => {
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
			cancelPress();
		}
	});
}

export function setupPowerMenu(): void {
	attachLongPress(imageBtn);
	attachLongPress(snippetsBtn);

	powerAttach.addEventListener("click", () => {
		closeMenu();
		fileInput.click();
	});

	powerVault.addEventListener("click", () => {
		closeMenu();
		openVaultDrawer();
	});

	powerBrowse.addEventListener("click", () => {
		closeMenu();
		openFileBrowser();
	});

	powerMenu.addEventListener("click", (e) => {
		if (e.target === powerMenu) {
			closeMenu();
		}
	});
}

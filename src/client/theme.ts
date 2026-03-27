import { getDefaultTheme, getTheme, themes } from "@/themes/index.js";

import { initShader } from "./shader.js";
import { state } from "./state.js";
import { themeList, colorList, canvas } from "./dom.js";

let shaderEngine: ReturnType<typeof initShader> = null;

export const ACCENT_COLORS = [
	{ name: "Lavender", value: "#c4b1f5" },
	{ name: "Cyan", value: "#38bdf8" },
	{ name: "Emerald", value: "#4ade80" },
	{ name: "Rose", value: "#f472b6" },
	{ name: "Amber", value: "#fbbf24" },
	{ name: "Coral", value: "#fb7185" },
	{ name: "Teal", value: "#2dd4bf" },
	{ name: "White", value: "#e4e4e7" }
];

export function applyTheme(id: string): void {
	const theme = getTheme(id);

	if (!theme) {
		return;
	}

	if (shaderEngine) {
		shaderEngine.setTheme(theme);
	}

	state.activeThemeId = theme.id;
	localStorage.setItem("wormhole-theme", theme.id);
	renderThemeList();
}

export function applyAccentColor(hex: string): void {
	const root = document.documentElement;
	root.style.setProperty("--accent", hex);

	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	root.style.setProperty("--accent-dim", `rgba(${r}, ${g}, ${b}, 0.08)`);

	state.activeAccent = hex;
	localStorage.setItem("wormhole-accent", hex);
}

export function renderThemeList(): void {
	themeList.innerHTML = "";

	for (const theme of themes) {
		const btn = document.createElement("button");
		btn.className = "theme-option";

		if (theme.id === state.activeThemeId) {
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

export function renderColorList(): void {
	colorList.innerHTML = "";

	for (const color of ACCENT_COLORS) {
		const btn = document.createElement("button");
		btn.className = "color-swatch";
		btn.title = color.name;
		btn.setAttribute("aria-label", color.name);

		if (color.value === state.activeAccent) {
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

export function initTheme(): void {
	const savedThemeId = localStorage.getItem("wormhole-theme");
	const initialTheme =
		(savedThemeId && getTheme(savedThemeId)) || getDefaultTheme();

	state.activeThemeId = initialTheme.id;

	try {
		shaderEngine = initShader(canvas, initialTheme);
	} catch (err) {
		console.error("initShader failed:", err);
	}
}

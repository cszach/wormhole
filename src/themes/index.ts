import type { Theme } from "./types.js";

import { starryNight } from "./starry-night.js";
import { aurora } from "./aurora.js";

export type { Theme };

export const themes: Theme[] = [
	starryNight,
	aurora
];

export function getTheme(id: string): Theme | undefined {
	return themes.find((t) => t.id === id);
}

export function getDefaultTheme(): Theme {
	return starryNight;
}

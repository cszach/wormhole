import type { Theme } from "./types.js";
import { starryNight } from "./starry-night.js";
import { aurora } from "./aurora.js";
import { nebula } from "./nebula.js";
import { topography } from "./topography.js";

export type { Theme };

export const themes: Theme[] = [starryNight, aurora, nebula, topography];

export function getTheme(id: string): Theme | undefined {
	return themes.find((t) => t.id === id);
}

export function getDefaultTheme(): Theme {
	return starryNight;
}

export const state = {
	ws: null as WebSocket | null,
	inClaudeCode: false,
	rawOutput: "",
	autoScroll: true,
	latencyMs: -1,
	readySessions: new Set<string>(),
	ttsEnabled: false,
	ttsRate: parseFloat(localStorage.getItem("wormhole-tts-rate") ?? "1.1"),
	activeThemeId: "",
	activeAccent: localStorage.getItem("wormhole-accent") ?? "#c4b1f5",
	prevInputLen: 0
};

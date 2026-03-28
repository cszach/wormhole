// Central DOM element references — imported by feature modules

export const wsDot = document.getElementById("ws-dot") as HTMLElement;
export const sessionNameEl = document.getElementById(
	"session-name"
) as HTMLElement;
export const sessionHint = document.getElementById(
	"session-hint"
) as HTMLElement;
export const wormholingEl = document.getElementById(
	"wormholing"
) as HTMLElement;
export const wormholingHint = document.getElementById(
	"wormholing-hint"
) as HTMLElement;
export const toastEl = document.getElementById("toast") as HTMLElement;
export const output = document.getElementById("output") as HTMLElement;
export const textInput = document.getElementById(
	"text-input"
) as HTMLTextAreaElement;
export const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
export const micBtn = document.getElementById("mic-btn") as HTMLButtonElement;
export const ttsToggle = document.getElementById(
	"tts-toggle"
) as HTMLInputElement;
export const imageInput = document.getElementById(
	"image-input"
) as HTMLInputElement;
export const imagePreviews = document.getElementById(
	"image-previews"
) as HTMLElement;
export const settingsBtn = document.getElementById(
	"settings-btn"
) as HTMLButtonElement;
export const settingsPanel = document.getElementById(
	"settings-panel"
) as HTMLElement;
export const settingsClose = document.getElementById(
	"settings-close"
) as HTMLButtonElement;
export const settingsBackdrop = settingsPanel.querySelector(
	".settings-backdrop"
) as HTMLElement;
export const themeList = document.getElementById("theme-list") as HTMLElement;
export const ccKeys = document.getElementById("cc-keys") as HTMLElement;
export const termKeys = document.getElementById("term-keys") as HTMLElement;
export const imageBtn = document.getElementById("image-btn") as HTMLElement;
export const snippetsBtn = document.getElementById(
	"snippets-btn"
) as HTMLButtonElement;
export const scrollBtn = document.getElementById(
	"scroll-btn"
) as HTMLButtonElement;
export const footer = document.querySelector("footer") as HTMLElement;
export const modOverlay = document.getElementById("mod-overlay") as HTMLElement;
export const modComboLabel = document.getElementById(
	"mod-combo-label"
) as HTMLElement;
export const modInput = document.getElementById(
	"mod-input"
) as HTMLInputElement;
export const modCancel = document.getElementById(
	"mod-cancel"
) as HTMLButtonElement;
export const canvas = document.getElementById("bg-shader") as HTMLCanvasElement;
export const ttsModeSelect = document.getElementById(
	"tts-mode"
) as HTMLSelectElement;
export const ttsRateInput = document.getElementById(
	"tts-rate"
) as HTMLInputElement;
export const ttsRateValue = document.getElementById(
	"tts-rate-value"
) as HTMLElement;
export const ttsVoiceSelect = document.getElementById(
	"tts-voice"
) as HTMLSelectElement;
export const colorList = document.getElementById("color-list") as HTMLElement;
export const skillsChips = document.getElementById(
	"skills-chips"
) as HTMLElement;
export const skillsAdd = document.getElementById(
	"skills-add"
) as HTMLInputElement;
export const skillsSync = document.getElementById(
	"skills-sync"
) as HTMLButtonElement;
export const snippetsList = document.getElementById(
	"snippets-list"
) as HTMLElement;
export const snippetsAdd = document.getElementById(
	"snippets-add"
) as HTMLInputElement;
export const saveSnippetBtn = document.getElementById(
	"save-snippet-btn"
) as HTMLButtonElement;
export const cmdPalette = document.getElementById("cmd-palette") as HTMLElement;
export const cmdList = document.getElementById("cmd-list") as HTMLElement;
export const cmdSearch = document.getElementById(
	"cmd-search"
) as HTMLInputElement;
export const cmdClose = document.getElementById(
	"cmd-close"
) as HTMLButtonElement;
export const cmdBackdrop = cmdPalette.querySelector(
	".cmd-backdrop"
) as HTMLElement;
export const autoColsCheckbox = document.getElementById(
	"auto-cols"
) as HTMLInputElement;
export const colsRow = document.getElementById("cols-row") as HTMLElement;
export const colsSlider = document.getElementById(
	"cols-slider"
) as HTMLInputElement;
export const colsValue = document.getElementById("cols-value") as HTMLElement;
export const sessionBtn = document.getElementById(
	"session-btn"
) as HTMLButtonElement;
export const sessionModal = document.getElementById(
	"session-modal"
) as HTMLElement;
export const sessionList = document.getElementById(
	"session-list"
) as HTMLElement;
export const sessionNewName = document.getElementById(
	"session-new-name"
) as HTMLInputElement;
export const sessionCreateBtn = document.getElementById(
	"session-create-btn"
) as HTMLButtonElement;
export const sessionError = document.getElementById(
	"session-error"
) as HTMLElement;
export const modalPing = document.getElementById("modal-ping") as HTMLElement;
export const modalPingValue = document.getElementById(
	"modal-ping-value"
) as HTMLElement;
export const searchBtn = document.getElementById(
	"search-btn"
) as HTMLButtonElement;
export const searchBar = document.getElementById("search-bar") as HTMLElement;
export const searchInput = document.getElementById(
	"search-input"
) as HTMLInputElement;
export const searchCount = document.getElementById(
	"search-count"
) as HTMLElement;
export const searchPrev = document.getElementById(
	"search-prev"
) as HTMLButtonElement;
export const searchNext = document.getElementById(
	"search-next"
) as HTMLButtonElement;
export const refreshBtn = document.getElementById(
	"refresh-btn"
) as HTMLButtonElement;
export const wormholingRefresh = document.getElementById(
	"wormholing-refresh"
) as HTMLElement;
export const snippetEditModal = document.getElementById(
	"snippet-edit-modal"
) as HTMLElement;
export const snippetEditInput = document.getElementById(
	"snippet-edit-input"
) as HTMLTextAreaElement;
export const snippetEditCancel = document.getElementById(
	"snippet-edit-cancel"
) as HTMLButtonElement;
export const snippetEditSave = document.getElementById(
	"snippet-edit-save"
) as HTMLButtonElement;

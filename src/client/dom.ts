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
export const fileInput = document.getElementById(
	"file-input"
) as HTMLInputElement;
export const filePreviews = document.getElementById(
	"file-previews"
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
export const fvTabWidth = document.getElementById(
	"fv-tab-width"
) as HTMLSelectElement;
export const fvSubtext = document.getElementById(
	"fv-subtext"
) as HTMLSelectElement;
export const vaultLockTimeout = document.getElementById(
	"vault-lock-timeout"
) as HTMLSelectElement;
export const vaultClipTimeout = document.getElementById(
	"vault-clip-timeout"
) as HTMLSelectElement;
export const themeList = document.getElementById("theme-list") as HTMLElement;
export const ccKeys = document.getElementById("cc-keys") as HTMLElement;
export const termKeys = document.getElementById("term-keys") as HTMLElement;
export const imageBtn = document.getElementById(
	"image-btn"
) as HTMLButtonElement;
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
export const sdPanel = document.getElementById("session-drawer") as HTMLElement;
export const sdBackdrop = sdPanel.querySelector(".fb-backdrop") as HTMLElement;
export const sdClose = document.getElementById("sd-close") as HTMLButtonElement;
export const sdSearch = document.getElementById(
	"sd-search"
) as HTMLInputElement;
export const sdNewSession = document.getElementById(
	"sd-new-session"
) as HTMLButtonElement;
export const sdCreate = document.getElementById("sd-create") as HTMLElement;
export const sdCreateInput = document.getElementById(
	"sd-create-input"
) as HTMLInputElement;
export const sdCreateBtn = document.getElementById(
	"sd-create-btn"
) as HTMLButtonElement;
export const sdError = document.getElementById("sd-error") as HTMLElement;
export const sdList = document.getElementById("sd-list") as HTMLElement;
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
export const vdPanel = document.getElementById("vault-drawer") as HTMLElement;
export const vdBackdrop = vdPanel.querySelector(".fb-backdrop") as HTMLElement;
export const vdClose = document.getElementById("vd-close") as HTMLButtonElement;
export const vdLocked = document.getElementById("vd-locked") as HTMLElement;
export const vdUnlocked = document.getElementById("vd-unlocked") as HTMLElement;
export const vdPassword = document.getElementById(
	"vd-password"
) as HTMLInputElement;
export const vdUnlockBtn = document.getElementById(
	"vd-unlock"
) as HTMLButtonElement;
export const vdResetBtn = document.getElementById(
	"vd-reset"
) as HTMLButtonElement;
export const vdHttpsWarning = document.getElementById(
	"vd-https-warning"
) as HTMLElement;
export const vdList = document.getElementById("vd-list") as HTMLElement;
export const vdSearch = document.getElementById(
	"vd-search"
) as HTMLInputElement;
export const vdAddToggle = document.getElementById(
	"vd-add-toggle"
) as HTMLButtonElement;
export const vdAddModal = document.getElementById(
	"vd-add-modal"
) as HTMLElement;
export const vdAddCancel = document.getElementById(
	"vd-add-cancel"
) as HTMLButtonElement;
export const vdAddLabel = document.getElementById(
	"vd-add-label"
) as HTMLInputElement;
export const vdAddPassword = document.getElementById(
	"vd-add-password"
) as HTMLInputElement;
export const vdAddBtn = document.getElementById(
	"vd-add-btn"
) as HTMLButtonElement;
export const vdLockBtn = document.getElementById(
	"vd-lock"
) as HTMLButtonElement;
export const qpPanel = document.getElementById("quick-preview") as HTMLElement;
export const qpBackdrop = qpPanel.querySelector(".fb-backdrop") as HTMLElement;
export const qpPath = document.getElementById("qp-path") as HTMLElement;
export const qpSub = document.getElementById("qp-sub") as HTMLElement;
export const qpDownload = document.getElementById(
	"qp-download"
) as HTMLAnchorElement;
export const qpClose = document.getElementById("qp-close") as HTMLButtonElement;
export const qpContent = document.getElementById("qp-content") as HTMLElement;
export const powerMenu = document.getElementById("power-menu") as HTMLElement;
export const powerAttach = document.getElementById(
	"power-attach"
) as HTMLButtonElement;
export const powerVault = document.getElementById(
	"power-vault"
) as HTMLButtonElement;
export const powerBrowse = document.getElementById(
	"power-browse"
) as HTMLButtonElement;
export const fbPanel = document.getElementById("file-browser") as HTMLElement;
export const fbBackdrop = fbPanel.querySelector(".fb-backdrop") as HTMLElement;
export const fbClose = document.getElementById("fb-close") as HTMLButtonElement;
export const fbSearch = document.getElementById(
	"fb-search"
) as HTMLInputElement;
export const fbRefresh = document.getElementById(
	"fb-refresh"
) as HTMLButtonElement;
export const fbBreadcrumb = document.getElementById(
	"fb-breadcrumb"
) as HTMLElement;
export const fbList = document.getElementById("fb-list") as HTMLElement;
export const fbPreview = document.getElementById("fb-preview") as HTMLElement;
export const fbPreviewPath = document.getElementById(
	"fb-preview-path"
) as HTMLElement;
export const fbPreviewSub = document.getElementById(
	"fb-preview-sub"
) as HTMLElement;
export const fbPreviewBack = document.getElementById(
	"fb-preview-back"
) as HTMLButtonElement;
export const fbPreviewContent = document.getElementById(
	"fb-preview-content"
) as HTMLElement;
export const fbDownload = document.getElementById(
	"fb-download"
) as HTMLAnchorElement;

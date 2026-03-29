import {
	createIcons,
	Download,
	Bookmark,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	CornerDownLeft,
	Ellipsis,
	Image,
	Mic,
	Search,
	RefreshCw,
	Send,
	Settings,
	Signal,
	X
} from "lucide";

import { state } from "./state.js";
import { snippetsBtn } from "./dom.js";
import { initTheme, applyAccentColor } from "./theme.js";
import {
	syncKeyLayout,
	syncFooterPadding,
	setupScrollHandlers,
	setupFooterObserver,
	setupKeyExpand
} from "./layout.js";
import { setupInputHandlers, restoreDraft, clearFiles } from "./input.js";
import { initSpeechRecognition, setupTtsSettings } from "./speech.js";
import { setupSettingsHandlers } from "./settings.js";
import { setupSkillHandlers } from "./skills.js";
import { setupSnippetHandlers } from "./snippets.js";
import { openCmdPalette, setupCommandPalette } from "./command-palette.js";
import { restoreColumnSettings, setupColumnHandlers } from "./columns.js";
import { setupSessionHandlers } from "./sessions.js";
import { setupSearchHandlers } from "./search.js";
import { connect } from "./connection.js";
import { relinkify } from "./render.js";
import { initVault } from "./vault.js";
import { setupPowerMenu } from "./power-menu.js";
import { setupFileBrowser, fetchTree } from "./file-browser.js";
import { setupVaultDrawer } from "./vault-drawer.js";
import { setupQuickPreview, openQuickPreview } from "./quick-preview.js";
import { setPathClickHandler } from "./linkify.js";

// Initialize shader + theme
initTheme();
applyAccentColor(state.activeAccent);

// Lucide icons
try {
	createIcons({
		icons: {
			Download,
			Bookmark,
			ChevronDown,
			ChevronLeft,
			ChevronRight,
			ChevronUp,
			CornerDownLeft,
			Ellipsis,
			Image,
			Mic,
			Search,
			RefreshCw,
			Send,
			Settings,
			Signal,
			X
		}
	});
} catch (err) {
	console.error("createIcons failed:", err);
}

// Clear stale image previews
try {
	clearFiles();
} catch (err) {
	console.error("clearFiles failed:", err);
}

// Restore draft text
restoreDraft();

// Initialize vault
initVault(state.ws);

// Restore column settings
restoreColumnSettings();

// Wire up all handlers
setupScrollHandlers();
setupFooterObserver();
setupKeyExpand();
setupInputHandlers();
setupSettingsHandlers();
setupTtsSettings();
setupSkillHandlers();
setupSnippetHandlers();
setupCommandPalette();
setupColumnHandlers();
setupSessionHandlers();
setupSearchHandlers();
setupPowerMenu();
setupFileBrowser();
setupVaultDrawer();
setupQuickPreview();
setPathClickHandler(openQuickPreview);

// Snippets button opens palette in snippets-only mode
snippetsBtn.addEventListener("click", () => {
	openCmdPalette(true);
});

// Initial layout sync
syncKeyLayout();
syncFooterPadding();

// Connect WebSocket
connect();

// Fetch file tree for linkification
fetchTree()
	.then(() => relinkify())
	.catch(() => {});

// Speech recognition
initSpeechRecognition();

// Re-sync layout on visibility change
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) {
		syncFooterPadding();
	}
});

import { state } from "./state.js";
import {
	cmdPalette,
	cmdList,
	cmdSearch,
	cmdClose,
	cmdBackdrop,
	textInput
} from "./dom.js";
import { showToast } from "./toast.js";
import {
	getVaultCommands,
	isVaultUnlocked,
	isVaultSecure,
	unlockWithPassword,
	getClipClearMs
} from "./vault.js";
import { getSkillCommands } from "./skills.js";
import type { Command } from "./skills.js";
import { getSnippetCommands } from "./snippets.js";

const BUILTIN_COMMANDS: Command[] = [
	{ name: "/help", desc: "Show help", section: "Built-in" },
	{ name: "/compact", desc: "Compact conversation", section: "Built-in" },
	{ name: "/context", desc: "Show context usage", section: "Built-in" },
	{ name: "/clear", desc: "Clear conversation", section: "Built-in" },
	{ name: "/cost", desc: "Show token costs", section: "Built-in" },
	{ name: "/memory", desc: "Edit memory", section: "Built-in" },
	{ name: "/mcp", desc: "MCP server status", section: "Built-in" },
	{ name: "/skills", desc: "List skills", section: "Built-in" },
	{ name: "/config", desc: "Show config", section: "Built-in" }
];

let cmdSnippetsOnly = false;

function renderCommandList(filter: string): void {
	cmdList.innerHTML = "";

	const vaultCmds = getVaultCommands();
	const allCommands = cmdSnippetsOnly
		? getSnippetCommands()
		: [...BUILTIN_COMMANDS, ...getSkillCommands(), ...getSnippetCommands()];
	const lowerFilter = filter.toLowerCase();
	const filtered = lowerFilter
		? allCommands.filter(
				(c) =>
					c.name.toLowerCase().includes(lowerFilter) ||
					c.desc.toLowerCase().includes(lowerFilter)
			)
		: allCommands;

	const filteredVault = lowerFilter
		? vaultCmds.filter((v) => v.label.toLowerCase().includes(lowerFilter))
		: vaultCmds;

	let currentSection = "";

	for (const cmd of filtered) {
		if (cmd.section !== currentSection) {
			currentSection = cmd.section;

			const label = document.createElement("div");
			label.className = "cmd-section-label";
			label.textContent = currentSection;
			cmdList.appendChild(label);
		}

		const btn = document.createElement("button");
		btn.className = "cmd-item";

		const name = document.createElement("span");
		name.textContent = cmd.name;

		const desc = document.createElement("span");
		desc.className = "cmd-item-desc";
		desc.textContent = cmd.desc;

		btn.appendChild(name);
		btn.appendChild(desc);

		btn.addEventListener("click", () => {
			textInput.value = cmd.section === "Snippets" ? cmd.name : cmd.name + " ";
			textInput.focus();
			textInput.style.height = "auto";
			textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
			closeCmdPalette();
		});

		cmdList.appendChild(btn);
	}

	if (!cmdSnippetsOnly && isVaultSecure() && !isVaultUnlocked()) {
		const vaultLabel = document.createElement("div");
		vaultLabel.className = "cmd-section-label";
		vaultLabel.textContent = "Vault";
		cmdList.appendChild(vaultLabel);

		const unlockRow = document.createElement("div");
		unlockRow.className = "cmd-vault-unlock";

		const pwInput = document.createElement("input");
		pwInput.type = "password";
		pwInput.className = "cmd-vault-password";
		pwInput.placeholder = "Master password\u2026";
		pwInput.setAttribute("aria-label", "Master password");
		pwInput.autocomplete = "off";

		const unlockBtn = document.createElement("button");
		unlockBtn.className = "cmd-vault-unlock-btn";
		unlockBtn.textContent = "Unlock";

		const doUnlock = async () => {
			if (!pwInput.value) {
				return;
			}
			const ok = await unlockWithPassword(pwInput.value);
			if (ok) {
				renderCommandList(filter);
			} else {
				pwInput.value = "";
				pwInput.placeholder = "Wrong password";
			}
		};

		unlockBtn.addEventListener("click", doUnlock);
		pwInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				doUnlock();
			}
		});

		unlockRow.append(pwInput, unlockBtn);
		cmdList.appendChild(unlockRow);
	}

	if (filteredVault.length > 0) {
		const vaultLabel = document.createElement("div");
		vaultLabel.className = "cmd-section-label";
		vaultLabel.textContent = "Vault";
		cmdList.appendChild(vaultLabel);

		for (const vcmd of filteredVault) {
			const row = document.createElement("div");
			row.className = "cmd-vault-item";

			const name = document.createElement("span");
			name.className = "cmd-vault-label";
			name.textContent = vcmd.label;

			const actions = document.createElement("div");
			actions.className = "cmd-vault-actions";

			const termBtn = document.createElement("button");
			termBtn.className = "cmd-vault-btn";
			termBtn.title = "Paste to terminal";
			termBtn.setAttribute("aria-label", "Paste to terminal");
			termBtn.innerHTML =
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
			termBtn.addEventListener("click", () => {
				vcmd.onTerminal();
				closeCmdPalette();
				showToast("Pasted to terminal");
			});

			const clipBtn = document.createElement("button");
			clipBtn.className = "cmd-vault-btn";
			clipBtn.title = "Copy to remote clipboard";
			clipBtn.setAttribute("aria-label", "Copy to remote clipboard");
			clipBtn.innerHTML =
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
			clipBtn.addEventListener("click", () => {
				vcmd.onClipboard();
				closeCmdPalette();
				const clearSec = getClipClearMs() / 1000;
				const clearLabel = clearSec > 0 ? ` \u2014 ${clearSec}s` : "";
				showToast(`Copied to remote clipboard${clearLabel}`);
			});

			actions.append(termBtn, clipBtn);
			row.append(name, actions);
			cmdList.appendChild(row);
		}
	}

	if (filtered.length === 0 && filteredVault.length === 0) {
		const empty = document.createElement("div");
		empty.className = "cmd-section-label";
		empty.textContent = "No commands found";
		cmdList.appendChild(empty);
	}
}

export function openCmdPalette(snippetsOnly = false): void {
	cmdSnippetsOnly = snippetsOnly;
	cmdPalette.hidden = false;
	cmdSearch.value = "";
	renderCommandList("");
	cmdSearch.focus();
}

function closeCmdPalette(): void {
	cmdPalette.hidden = true;
	textInput.focus();
}

export function setupCommandPalette(): void {
	cmdClose.addEventListener("click", () => {
		closeCmdPalette();
	});

	cmdBackdrop.addEventListener("click", () => {
		closeCmdPalette();
	});

	cmdSearch.addEventListener("input", () => {
		renderCommandList(cmdSearch.value);
	});

	// Open palette when user types / as first character (Claude Code only)
	textInput.addEventListener("input", () => {
		const len = textInput.value.length;

		if (
			textInput.value === "/" &&
			len > state.prevInputLen &&
			state.inClaudeCode
		) {
			openCmdPalette();
		}

		state.prevInputLen = len;
	});
}

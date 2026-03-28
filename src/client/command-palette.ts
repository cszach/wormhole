import { state } from "./state.js";
import {
	cmdPalette,
	cmdList,
	cmdSearch,
	cmdClose,
	cmdBackdrop,
	textInput
} from "./dom.js";
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

	if (filtered.length === 0) {
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

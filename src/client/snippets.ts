import {
	snippetsList,
	snippetsAdd,
	saveSnippetBtn,
	output,
	snippetEditModal,
	snippetEditInput,
	snippetEditCancel,
	snippetEditSave
} from "./dom.js";
import type { Command } from "./skills.js";

function getSnippets(): string[] {
	try {
		return JSON.parse(localStorage.getItem("wormhole-snippets") ?? "[]");
	} catch {
		return [];
	}
}

function saveSnippets(snippets: string[]): void {
	localStorage.setItem("wormhole-snippets", JSON.stringify(snippets));
}

export function addSnippet(text: string): void {
	const snippets = getSnippets();

	if (!snippets.includes(text)) {
		snippets.push(text);
		saveSnippets(snippets);
	}
}

let editingIndex = -1;

function openEditModal(index: number): void {
	const snippets = getSnippets();
	if (index < 0 || index >= snippets.length) {
		return;
	}

	editingIndex = index;
	snippetEditInput.value = snippets[index];
	snippetEditModal.hidden = false;
	snippetEditInput.focus();
}

function closeEditModal(): void {
	snippetEditModal.hidden = true;
	editingIndex = -1;
}

function saveEdit(): void {
	const newValue = snippetEditInput.value.trim();
	if (!newValue || editingIndex < 0) {
		closeEditModal();
		return;
	}

	const snippets = getSnippets();
	if (editingIndex < snippets.length) {
		snippets[editingIndex] = newValue;
		saveSnippets(snippets);
		renderSnippetList();
	}

	closeEditModal();
}

export function renderSnippetList(): void {
	snippetsList.innerHTML = "";

	const allSnippets = getSnippets();

	for (let i = 0; i < allSnippets.length; i++) {
		const snippet = allSnippets[i];
		const row = document.createElement("div");
		row.className = "snippet-item";

		const label = document.createElement("button");
		label.className = "snippet-item-text";
		label.textContent = snippet.replace(/\n/g, " ");
		label.title = snippet;

		label.addEventListener("click", () => {
			openEditModal(i);
		});

		const del = document.createElement("button");
		del.className = "session-delete";
		del.textContent = "\u00d7";
		del.title = "Remove snippet";
		del.setAttribute("aria-label", "Remove snippet");

		del.addEventListener("click", () => {
			const snippets = getSnippets().filter((s) => s !== snippet);
			saveSnippets(snippets);
			renderSnippetList();
		});

		row.appendChild(label);
		row.appendChild(del);
		snippetsList.appendChild(row);
	}
}

export function getSnippetCommands(): Command[] {
	return getSnippets().map((s) => ({
		name: s,
		desc: "",
		section: "Snippets"
	}));
}

function extractSelectionWithNewlines(): string {
	const sel = window.getSelection();

	if (!sel || sel.rangeCount === 0) {
		return "";
	}

	const range = sel.getRangeAt(0);
	const fragment = range.cloneContents();
	const divs = fragment.querySelectorAll("div");

	if (divs.length > 0) {
		return Array.from(divs)
			.map((d) => d.textContent ?? "")
			.join("\n")
			.trim();
	}

	return sel.toString().trim();
}

export function setupSnippetHandlers(): void {
	snippetsAdd.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();

			const val = snippetsAdd.value.trim();

			if (!val) {
				return;
			}

			addSnippet(val);
			renderSnippetList();
			snippetsAdd.value = "";
		}
	});

	document.addEventListener("selectionchange", () => {
		const sel = window.getSelection();
		const text = sel?.toString().trim() ?? "";

		if (text && output.contains(sel?.anchorNode ?? null)) {
			saveSnippetBtn.hidden = false;
		} else {
			saveSnippetBtn.hidden = true;
		}
	});

	saveSnippetBtn.addEventListener("click", () => {
		const text = extractSelectionWithNewlines();
		const sel = window.getSelection();

		if (text) {
			addSnippet(text);
			sel?.removeAllRanges();
			saveSnippetBtn.hidden = true;
		}
	});

	snippetEditCancel.addEventListener("click", closeEditModal);
	snippetEditSave.addEventListener("click", saveEdit);

	snippetEditModal.addEventListener("click", (e) => {
		if (e.target === snippetEditModal) {
			closeEditModal();
		}
	});

	snippetEditInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeEditModal();
		}
	});
}

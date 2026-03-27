import {
	output,
	searchBtn,
	searchBar,
	searchInput,
	searchCount,
	searchPrev,
	searchNext
} from "./dom.js";
import { setRerunSearch } from "./render.js";

let searchMatches: Element[] = [];
let searchIndex = -1;

function clearSearch(): void {
	const marks = output.querySelectorAll("mark.search-hit");

	for (const m of Array.from(marks)) {
		const text = document.createTextNode(m.textContent ?? "");
		m.parentNode?.replaceChild(text, m);
	}

	output.normalize();
	searchMatches = [];
	searchIndex = -1;
	searchCount.textContent = "";
}

function doSearch(query: string): void {
	clearSearch();

	if (!query) {
		return;
	}

	const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let node: Text | null;

	while ((node = walker.nextNode() as Text | null)) {
		textNodes.push(node);
	}

	const lowerQuery = query.toLowerCase();

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const lower = text.toLowerCase();
		let idx = lower.indexOf(lowerQuery);

		if (idx === -1) {
			continue;
		}

		const frag = document.createDocumentFragment();
		let lastIdx = 0;

		while (idx !== -1) {
			if (idx > lastIdx) {
				frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
			}

			const mark = document.createElement("mark");
			mark.className = "search-hit";
			mark.textContent = text.slice(idx, idx + query.length);
			frag.appendChild(mark);
			lastIdx = idx + query.length;
			idx = lower.indexOf(lowerQuery, lastIdx);
		}

		if (lastIdx < text.length) {
			frag.appendChild(document.createTextNode(text.slice(lastIdx)));
		}

		textNode.parentNode?.replaceChild(frag, textNode);
	}

	searchMatches = Array.from(output.querySelectorAll("mark.search-hit"));

	if (searchMatches.length > 0) {
		searchIndex = 0;
		searchMatches[0].classList.add("search-active");
		searchMatches[0].scrollIntoView({ block: "center" });
		searchCount.textContent = `1/${searchMatches.length}`;
	} else {
		searchCount.textContent = "0";
	}
}

function navigateSearch(dir: number): void {
	if (searchMatches.length === 0) {
		return;
	}

	searchMatches[searchIndex].classList.remove("search-active");
	searchIndex =
		(searchIndex + dir + searchMatches.length) % searchMatches.length;
	searchMatches[searchIndex].classList.add("search-active");
	searchMatches[searchIndex].scrollIntoView({ block: "center" });
	searchCount.textContent = `${searchIndex + 1}/${searchMatches.length}`;
}

function openSearch(): void {
	searchBar.hidden = false;
	searchInput.value = "";
	searchInput.focus();
}

function closeSearch(): void {
	searchBar.hidden = true;
	clearSearch();
}

export function setupSearchHandlers(): void {
	setRerunSearch(() => {
		if (!searchBar.hidden && searchInput.value) {
			doSearch(searchInput.value);
		}
	});

	searchBtn.addEventListener("click", () => {
		if (searchBar.hidden) {
			openSearch();
		} else {
			closeSearch();
		}
	});

	searchInput.addEventListener("input", () => {
		doSearch(searchInput.value);
	});

	searchPrev.addEventListener("click", () => {
		navigateSearch(-1);
	});

	searchNext.addEventListener("click", () => {
		navigateSearch(1);
	});

	searchInput.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeSearch();
		} else if (event.key === "Enter") {
			navigateSearch(event.shiftKey ? -1 : 1);
		}
	});
}

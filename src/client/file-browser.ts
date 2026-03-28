import hljs from "highlight.js/lib/common";

import {
	fbPanel,
	fbBackdrop,
	fbClose,
	fbSearch,
	fbRefresh,
	fbBreadcrumb,
	fbList,
	fbPreview,
	fbPreviewBack,
	fbPreviewContent,
	fbDownload
} from "./dom.js";

type TreeEntry = {
	path: string;
	type: "file" | "directory";
	size: number;
};

let tree: TreeEntry[] = [];
let truncated = false;
let currentDir = ".";

const IGNORE_KEY = "wormhole-fb-ignore";
const DEFAULT_IGNORE = ".git";

const FOLDER_SVG =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
	' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
	'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2' +
	'h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

const FILE_SVG =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
	' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
	'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0' +
	' 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

const IMAGE_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp"
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

function getExtension(name: string): string {
	const i = name.lastIndexOf(".");
	return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return bytes + " B";
	}
	if (bytes < 1024 * 1024) {
		return (bytes / 1024).toFixed(1) + " KB";
	}
	return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function basename(p: string): string {
	const i = p.lastIndexOf("/");
	return i >= 0 ? p.slice(i + 1) : p;
}

function parentDir(p: string): string {
	const i = p.lastIndexOf("/");
	return i >= 0 ? p.slice(0, i) : ".";
}

function getIgnore(): string {
	return localStorage.getItem(IGNORE_KEY) ?? DEFAULT_IGNORE;
}

// --- Tree fetching ---

async function fetchTree(): Promise<void> {
	const ignore = getIgnore();
	const res = await fetch(
		"/api/files/tree?ignore=" + encodeURIComponent(ignore)
	);
	const data = await res.json();
	tree = data.entries ?? [];
	truncated = data.truncated ?? false;
}

// --- Directory listing from cache ---

type DirEntry = {
	name: string;
	type: "file" | "directory";
	size: number;
	path: string;
};

function listDir(dir: string): DirEntry[] {
	const prefix = dir === "." ? "" : dir + "/";
	const entries: DirEntry[] = [];
	const seen = new Set<string>();

	for (const entry of tree) {
		if (prefix && !entry.path.startsWith(prefix)) {
			continue;
		}

		const rel = prefix ? entry.path.slice(prefix.length) : entry.path;
		const slashIdx = rel.indexOf("/");

		if (slashIdx === -1) {
			// Direct child
			entries.push({
				name: rel,
				type: entry.type,
				size: entry.size,
				path: entry.path
			});
		} else {
			// Subdirectory
			const dirName = rel.slice(0, slashIdx);
			if (!seen.has(dirName)) {
				seen.add(dirName);
				entries.push({
					name: dirName,
					type: "directory",
					size: 0,
					path: prefix + dirName
				});
			}
		}
	}

	entries.sort((a, b) => {
		if (a.type !== b.type) {
			return a.type === "directory" ? -1 : 1;
		}
		return a.name.localeCompare(b.name);
	});

	return entries;
}

// --- Search ---

function searchTree(query: string): DirEntry[] {
	const lower = query.toLowerCase();
	const results: DirEntry[] = [];

	for (const entry of tree) {
		if (entry.path.toLowerCase().includes(lower)) {
			results.push({
				name: entry.path,
				type: entry.type,
				size: entry.size,
				path: entry.path
			});
		}

		if (results.length >= 100) {
			break;
		}
	}

	return results;
}

// --- Rendering ---

function renderBreadcrumb(): void {
	fbBreadcrumb.innerHTML = "";

	const parts = currentDir === "." ? [] : currentDir.split("/");

	const rootBtn = document.createElement("button");
	rootBtn.type = "button";
	rootBtn.textContent = "~";
	rootBtn.addEventListener("click", () => navigateTo("."));
	fbBreadcrumb.appendChild(rootBtn);

	for (let i = 0; i < parts.length; i++) {
		const sep = document.createElement("span");
		sep.textContent = "/";
		fbBreadcrumb.appendChild(sep);

		if (i === parts.length - 1) {
			const current = document.createElement("span");
			current.className = "fb-crumb-current";
			current.textContent = parts[i];
			fbBreadcrumb.appendChild(current);
		} else {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = parts[i];
			const target = parts.slice(0, i + 1).join("/");
			btn.addEventListener("click", () => navigateTo(target));
			fbBreadcrumb.appendChild(btn);
		}
	}
}

function renderEntries(entries: DirEntry[], isSearch: boolean): void {
	fbList.innerHTML = "";

	if (entries.length === 0) {
		fbList.innerHTML =
			'<div class="fb-empty">' +
			(isSearch ? "No matches" : "Empty directory") +
			"</div>";
		return;
	}

	for (const entry of entries) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "fb-item";

		const icon = document.createElement("span");
		icon.className =
			"fb-item-icon" + (entry.type === "directory" ? " fb-item-icon--dir" : "");
		icon.innerHTML = entry.type === "directory" ? FOLDER_SVG : FILE_SVG;

		const name = document.createElement("span");
		name.className = "fb-item-name";
		name.textContent = isSearch ? entry.path : entry.name;

		btn.appendChild(icon);
		btn.appendChild(name);

		if (entry.type === "file") {
			const size = document.createElement("span");
			size.className = "fb-item-size";
			size.textContent = formatSize(entry.size);
			btn.appendChild(size);
		}

		btn.addEventListener("click", () => {
			if (entry.type === "directory") {
				fbSearch.value = "";
				navigateTo(entry.path);
			} else {
				if (isSearch) {
					currentDir = parentDir(entry.path);
					renderBreadcrumb();
				}
				openPreview(entry);
			}
		});

		fbList.appendChild(btn);
	}

	if (truncated && !isSearch) {
		const msg = document.createElement("div");
		msg.className = "fb-empty";
		msg.textContent = "File tree truncated (10,000 entry limit)";
		fbList.appendChild(msg);
	}
}

function navigateTo(dir: string): void {
	currentDir = dir;
	closePreview();
	renderBreadcrumb();
	renderEntries(listDir(dir), false);
}

// --- Preview ---

async function openPreview(entry: DirEntry): Promise<void> {
	const readUrl = "/api/files/read?path=" + encodeURIComponent(entry.path);
	const downloadUrl =
		"/api/files/download?path=" + encodeURIComponent(entry.path);
	const ext = getExtension(entry.name);

	fbDownload.href = downloadUrl;
	fbPreviewContent.innerHTML = "";
	fbPreview.hidden = false;

	if (IMAGE_EXTENSIONS.has(ext)) {
		const img = document.createElement("img");
		img.src = readUrl;
		img.alt = basename(entry.path);
		fbPreviewContent.appendChild(img);
		return;
	}

	if (VIDEO_EXTENSIONS.has(ext)) {
		const video = document.createElement("video");
		video.src = readUrl;
		video.controls = true;
		video.playsInline = true;
		fbPreviewContent.appendChild(video);
		return;
	}

	if (AUDIO_EXTENSIONS.has(ext)) {
		const audio = document.createElement("audio");
		audio.src = readUrl;
		audio.controls = true;
		fbPreviewContent.appendChild(audio);
		return;
	}

	if (ext === ".pdf") {
		const iframe = document.createElement("iframe");
		iframe.src = readUrl;
		iframe.title = basename(entry.path);
		fbPreviewContent.appendChild(iframe);
		return;
	}

	try {
		const res = await fetch(readUrl);
		const contentType = res.headers.get("content-type") ?? "";
		const isText =
			contentType.startsWith("text/") ||
			contentType.includes("json") ||
			contentType.includes("xml");

		if (!isText) {
			fbPreviewContent.innerHTML =
				'<div class="fb-unknown">' +
				`<p>${basename(entry.path)}</p>` +
				`<p>${formatSize(entry.size)}</p>` +
				"</div>";
			return;
		}

		const text = await res.text();
		const pre = document.createElement("pre");

		if (ext === ".md") {
			pre.innerHTML = renderMarkdown(text);
		} else {
			const code = document.createElement("code");
			code.textContent = text;
			hljs.highlightElement(code);
			pre.appendChild(code);
		}

		fbPreviewContent.appendChild(pre);
	} catch {
		fbPreviewContent.innerHTML =
			'<div class="fb-unknown">Failed to load file</div>';
	}
}

function closePreview(): void {
	fbPreview.hidden = true;
	fbPreviewContent.innerHTML = "";
}

function renderMarkdown(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/^### (.+)$/gm, "<strong>$1</strong>")
		.replace(/^## (.+)$/gm, "<strong>$1</strong>")
		.replace(/^# (.+)$/gm, "<strong>$1</strong>")
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/`(.+?)`/g, "<code>$1</code>");
}

// --- Public API ---

export async function openFileBrowser(): Promise<void> {
	fbPanel.hidden = false;
	currentDir = ".";
	fbSearch.value = "";
	closePreview();
	renderBreadcrumb();
	fbList.innerHTML = '<div class="fb-empty">Loading\u2026</div>';

	await fetchTree();
	renderEntries(listDir("."), false);
}

function closeFileBrowser(): void {
	fbPanel.hidden = true;
	closePreview();
}

export function setupFileBrowser(): void {
	fbClose.addEventListener("click", closeFileBrowser);
	fbBackdrop.addEventListener("click", closeFileBrowser);
	fbPreviewBack.addEventListener("click", closePreview);

	fbSearch.addEventListener("input", () => {
		const query = fbSearch.value.trim();

		if (query) {
			closePreview();
			fbBreadcrumb.innerHTML = "";
			renderEntries(searchTree(query), true);
		} else {
			navigateTo(currentDir);
		}
	});

	fbRefresh.addEventListener("click", async () => {
		fbRefresh.disabled = true;
		fbList.innerHTML = '<div class="fb-empty">Refreshing\u2026</div>';

		await fetchTree();

		const query = fbSearch.value.trim();

		if (query) {
			renderEntries(searchTree(query), true);
		} else {
			renderEntries(listDir(currentDir), false);
		}

		fbRefresh.disabled = false;
	});
}

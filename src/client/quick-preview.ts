import hljs from "highlight.js/lib/common";

import {
	qpPanel,
	qpBackdrop,
	qpTitle,
	qpDownload,
	qpClose,
	qpContent
} from "./dom.js";
import { renderMarkdown } from "./markdown.js";

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

function basename(p: string): string {
	const i = p.lastIndexOf("/");
	return i >= 0 ? p.slice(i + 1) : p;
}

export async function openQuickPreview(filePath: string): Promise<void> {
	const readUrl = "/api/files/read?path=" + encodeURIComponent(filePath);
	const downloadUrl =
		"/api/files/download?path=" + encodeURIComponent(filePath);
	const ext = getExtension(filePath);
	const name = basename(filePath);

	qpTitle.textContent = name;
	qpDownload.href = downloadUrl;
	qpContent.innerHTML = "";
	qpPanel.hidden = false;

	if (IMAGE_EXTENSIONS.has(ext)) {
		const img = document.createElement("img");
		img.src = readUrl;
		img.alt = name;
		qpContent.appendChild(img);
		return;
	}

	if (VIDEO_EXTENSIONS.has(ext)) {
		const video = document.createElement("video");
		video.src = readUrl;
		video.controls = true;
		video.playsInline = true;
		qpContent.appendChild(video);
		return;
	}

	if (AUDIO_EXTENSIONS.has(ext)) {
		const audio = document.createElement("audio");
		audio.src = readUrl;
		audio.controls = true;
		qpContent.appendChild(audio);
		return;
	}

	if (ext === ".pdf") {
		const iframe = document.createElement("iframe");
		iframe.src = readUrl;
		iframe.title = name;
		qpContent.appendChild(iframe);
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
			qpContent.innerHTML =
				'<div class="fb-unknown">' + `<p>${name}</p>` + "</div>";
			return;
		}

		const text = await res.text();

		if (ext === ".md") {
			const div = document.createElement("div");
			div.className = "md-rendered";
			div.innerHTML = renderMarkdown(text, filePath);
			qpContent.appendChild(div);
		} else {
			const pre = document.createElement("pre");
			const code = document.createElement("code");
			code.textContent = text;
			hljs.highlightElement(code);
			pre.appendChild(code);
			qpContent.appendChild(pre);
		}
	} catch {
		qpContent.innerHTML = '<div class="fb-unknown">Failed to load file</div>';
	}
}

function closeQuickPreview(): void {
	qpPanel.hidden = true;
	qpContent.innerHTML = "";
}

export function setupQuickPreview(): void {
	qpClose.addEventListener("click", closeQuickPreview);
	qpBackdrop.addEventListener("click", closeQuickPreview);
}

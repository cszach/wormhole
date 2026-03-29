import { marked, Renderer } from "marked";

function parentDir(p: string): string {
	const i = p.lastIndexOf("/");
	return i >= 0 ? p.slice(0, i) : ".";
}

function isAbsolute(url: string): boolean {
	return /^https?:\/\/|^\/|^data:|^#/.test(url);
}

function resolveRelative(href: string, dir: string): string {
	const resolved = dir === "." ? href : dir + "/" + href;
	return "/api/files/read?path=" + encodeURIComponent(resolved);
}

export function renderMarkdown(text: string, filePath: string): string {
	const dir = parentDir(filePath);
	const renderer = new Renderer();

	renderer.image = ({ href, title, text: alt }) => {
		const src = isAbsolute(href) ? href : resolveRelative(href, dir);
		const titleAttr = title ? ` title="${title}"` : "";
		return `<img src="${src}" alt="${alt}"${titleAttr} />`;
	};

	renderer.link = ({ href, title, text: content }) => {
		const titleAttr = title ? ` title="${title}"` : "";

		if (isAbsolute(href)) {
			return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${content}</a>`;
		}

		const resolved = resolveRelative(href, dir);
		return `<a href="${resolved}"${titleAttr}>${content}</a>`;
	};

	const html = marked.parse(text, { renderer }) as string;

	// Rewrite relative src/href in pass-through HTML tags (e.g. <img src="...">)
	return html.replace(
		/(<(?:img|source)\s[^>]*?\bsrc\s*=\s*")([^"]+)(")/gi,
		(_, before, src, after) =>
			before + (isAbsolute(src) ? src : resolveRelative(src, dir)) + after
	);
}

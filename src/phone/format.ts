const DEFAULT_MAX_LEN = 1400;
const SOFT_BREAK_MIN_RATIO = 0.6;

export function stripMarkdown(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, (block) =>
			block
				.replace(/```\w*\n?/g, "")
				.replace(/```$/g, "")
				.trim()
		)
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/__([^_]+)__/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#+\s+/gm, "");
}

export function splitForSms(
	text: string,
	maxLen: number = DEFAULT_MAX_LEN
): string[] {
	const cleaned = stripMarkdown(text).trim();

	if (cleaned.length === 0) {
		return [];
	}

	if (cleaned.length <= maxLen) {
		return [cleaned];
	}

	const out: string[] = [];
	let remaining = cleaned;

	while (remaining.length > maxLen) {
		const slice = remaining.slice(0, maxLen);
		const breakPoints = [
			slice.lastIndexOf("\n\n"),
			slice.lastIndexOf("\n"),
			slice.lastIndexOf(". "),
			slice.lastIndexOf(" ")
		];
		const best = breakPoints.find((idx) => idx > maxLen * SOFT_BREAK_MIN_RATIO);
		const cut = best ?? maxLen;
		out.push(slice.slice(0, cut).trim());
		remaining = remaining.slice(cut).trim();
	}

	if (remaining.length > 0) {
		out.push(remaining);
	}

	return out;
}

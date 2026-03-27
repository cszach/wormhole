const SESSION_NAME_RE = /^[^.:]+$/;
const SESSION_MAX_LEN = 20;

export function isValidSessionName(name: string): string | null {
	if (!name || name.trim().length === 0) {
		return "Session name cannot be empty";
	}

	if (name.length > SESSION_MAX_LEN) {
		return `Session name must be ${SESSION_MAX_LEN} characters or fewer`;
	}

	if (!SESSION_NAME_RE.test(name)) {
		return "Session name cannot contain . or :";
	}

	return null;
}

import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 250;

export type PhoneState = {
	version: number;
	agentSessionId: string | null;
	lastInboundAt: number;
};

const defaultState: PhoneState = {
	version: SCHEMA_VERSION,
	agentSessionId: null,
	lastInboundAt: 0
};

export class PhoneStateStore {
	private state: PhoneState = { ...defaultState };
	private writeTimer: NodeJS.Timeout | null = null;

	constructor(private readonly filePath: string) {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		this.load();
	}

	get(): PhoneState {
		return { ...this.state };
	}

	update(patch: Partial<PhoneState>): void {
		this.state = { ...this.state, ...patch };
		this.scheduleFlush();
	}

	flushNow(): void {
		if (this.writeTimer !== null) {
			clearTimeout(this.writeTimer);
			this.writeTimer = null;
		}

		const tmp = `${this.filePath}.tmp.${process.pid}`;
		fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), {
			mode: 0o600
		});
		fs.renameSync(tmp, this.filePath);
	}

	private load(): void {
		try {
			const raw = fs.readFileSync(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as Partial<PhoneState>;

			if (parsed.version === SCHEMA_VERSION) {
				this.state = { ...defaultState, ...parsed };
			}
		} catch {
			// fresh start — file missing or malformed
		}
	}

	private scheduleFlush(): void {
		if (this.writeTimer !== null) {
			clearTimeout(this.writeTimer);
		}

		this.writeTimer = setTimeout(() => {
			this.flushNow();
		}, DEBOUNCE_MS);
	}
}

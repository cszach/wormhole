import type { InboundSms } from "./provider/index.js";

const MAX_QUEUE = 1000;
const DEDUP_CAP = 200;

export class Inbox {
	private queue: InboundSms[] = [];
	private readonly seen = new Set<string>();
	private readonly seenOrder: string[] = [];

	enqueue(msg: InboundSms): boolean {
		if (this.seen.has(msg.sid)) {
			return false;
		}

		this.seen.add(msg.sid);
		this.seenOrder.push(msg.sid);

		if (this.seenOrder.length > DEDUP_CAP) {
			const evict = this.seenOrder.shift();
			if (evict !== undefined) {
				this.seen.delete(evict);
			}
		}

		this.queue.push(msg);

		if (this.queue.length > MAX_QUEUE) {
			this.queue.shift();
		}

		return true;
	}

	drain(): InboundSms[] {
		const out = this.queue;
		this.queue = [];
		return out;
	}

	peek(): InboundSms[] {
		return [...this.queue];
	}

	size(): number {
		return this.queue.length;
	}
}

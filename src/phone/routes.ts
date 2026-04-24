import type { Express, NextFunction, Request, Response } from "express";

import type { PhoneAgent } from "./agent.js";
import type { SmsProvider } from "./provider/index.js";

export type PhoneRouteOpts = {
	provider: SmsProvider;
	agent: PhoneAgent;
	allowedFrom: string | null;
	log: Pick<Console, "log" | "warn" | "error">;
};

type RequestWithRaw = Request & { rawBody?: Buffer };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const STOP_KEYWORDS: ReadonlySet<string> = new Set([
	"STOP",
	"UNSUBSCRIBE",
	"CANCEL",
	"END",
	"QUIT"
]);
const HELP_KEYWORDS: ReadonlySet<string> = new Set(["HELP", "INFO"]);

export function mountPhoneRoutes(app: Express, opts: PhoneRouteOpts): void {
	const limiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

	app.post(
		"/api/phone/sms",
		(req: Request, res: Response, next: NextFunction) => {
			const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
			if (!limiter.allow(ip)) {
				opts.log.warn(
					`[phone-agent] rate-limited ip=${ip} (>${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW_MS}ms)`
				);
				res.status(429).json({ error: "rate limited" });
				return;
			}
			next();
		},
		async (req: Request, res: Response) => {
			const reqRaw = req as RequestWithRaw;
			const rawBody =
				reqRaw.rawBody instanceof Buffer
					? reqRaw.rawBody.toString("utf8")
					: typeof req.body === "string"
						? req.body
						: JSON.stringify(req.body ?? {});

			const headers: Record<string, string | string[] | undefined> = {};
			for (const [k, v] of Object.entries(req.headers)) {
				headers[k.toLowerCase()] = v;
			}

			const verdict = await opts.provider.verifyAndParse({
				rawBody,
				parsedBody: req.body,
				headers
			});

			if (!verdict.valid) {
				opts.log.warn(`[phone-agent] rejected webhook: ${verdict.reason}`);
				res.status(401).json({ error: "unauthorized" });
				return;
			}

			const { inbound } = verdict;

			if (opts.allowedFrom !== null && inbound.from !== opts.allowedFrom) {
				opts.log.warn(
					`[phone-agent] rejected non-allowlisted from=${inbound.from}`
				);
				res.status(403).json({ error: "forbidden" });
				return;
			}

			const trimmed = inbound.body.trim().toUpperCase();
			if (STOP_KEYWORDS.has(trimmed)) {
				opts.log.log(
					`[phone-agent] STOP/unsubscribe keyword received sid=${inbound.sid}; carrier-handled, not enqueuing`
				);
				res.status(200).json({ ok: true, action: "stop" });
				return;
			}
			if (HELP_KEYWORDS.has(trimmed)) {
				opts.log.log(
					`[phone-agent] HELP keyword received sid=${inbound.sid}; carrier-handled, not enqueuing`
				);
				res.status(200).json({ ok: true, action: "help" });
				return;
			}

			opts.log.log(
				`[phone-agent] inbound sid=${inbound.sid} from=${inbound.from} len=${inbound.body.length}`
			);

			// Ack fast; process async to stay under webhook retry threshold.
			res.status(200).json({ ok: true, sid: inbound.sid });
			opts.agent.enqueue(inbound);
		}
	);

	app.get("/api/phone/status", (_req: Request, res: Response) => {
		res.json({
			ok: true,
			provider: opts.provider.kind
		});
	});
}

type RateLimiter = {
	allow(key: string): boolean;
};

function createRateLimiter(max: number, windowMs: number): RateLimiter {
	const buckets = new Map<string, number[]>();

	return {
		allow(key) {
			const now = Date.now();
			const cutoff = now - windowMs;
			const stamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

			if (stamps.length >= max) {
				buckets.set(key, stamps);
				return false;
			}

			stamps.push(now);
			buckets.set(key, stamps);
			return true;
		}
	};
}

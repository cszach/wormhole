import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
	createPhoneMcpServer,
	PHONE_MCP_SERVER_NAME,
	type PhoneToolOpts
} from "./tools.js";

export type McpServerHandle = {
	url: string;
	serverName: string;
	close(): Promise<void>;
};

const MCP_PATH = "/mcp";

export async function startPhoneMcpHttpServer(
	toolOpts: PhoneToolOpts,
	log: Pick<Console, "log" | "warn" | "error">
): Promise<McpServerHandle> {
	const mcp = createPhoneMcpServer(toolOpts);
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		enableDnsRebindingProtection: true,
		allowedHosts: ["127.0.0.1", "localhost"],
		allowedOrigins: []
	});

	await mcp.connect(transport);

	const app = express();
	app.use(express.json());

	app.all(MCP_PATH, (req, res) => {
		transport.handleRequest(req, res, req.body).catch((err) => {
			log.error("[phone-mcp] handleRequest error", err);
			if (!res.headersSent) {
				res.status(500).json({ error: String(err) });
			}
		});
	});

	const httpServer: HttpServer = createServer(app);

	await new Promise<void>((resolve) => {
		httpServer.listen(0, "127.0.0.1", () => {
			resolve();
		});
	});

	const addr = httpServer.address();
	if (addr === null || typeof addr === "string") {
		throw new Error("failed to bind MCP HTTP server");
	}

	const url = `http://127.0.0.1:${addr.port}${MCP_PATH}`;
	log.log(`[phone-mcp] listening at ${url}`);

	return {
		url,
		serverName: PHONE_MCP_SERVER_NAME,
		async close() {
			await new Promise<void>((resolve, reject) => {
				httpServer.close((err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
			await mcp.close();
		}
	};
}

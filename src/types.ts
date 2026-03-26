export type ClientMessage = {
	type: "send";
	text: string;
	imagePaths?: string[];
};

export type ServerMessage =
	| { type: "output"; content: string }
	| { type: "stable" }
	| { type: "session"; session: string }
	| { type: "pong"; ts: number }
	| { type: "bg-stable"; session: string }
	| { type: "bg-clear"; session: string };

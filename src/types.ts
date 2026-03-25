export type ClientMessage = {
	type: "send";
	text: string;
	imagePaths?: string[];
};

export type ServerMessage =
	| { type: "output"; content: string }
	| { type: "stable" }
	| { type: "session"; session: string };

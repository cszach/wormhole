export type ClientMessage = {
	type: "send";
	text: string;
	imagePaths?: string[];
};

export type VaultCredential = {
	id: string;
	label: string;
	password: string;
};

export type VaultPayload = {
	credentials: VaultCredential[];
};

export type ServerMessage =
	| { type: "output"; content: string }
	| { type: "stable" }
	| { type: "session"; session: string }
	| { type: "pong"; ts: number }
	| { type: "bg-stable"; session: string }
	| { type: "bg-clear"; session: string }
	| { type: "vault-inject-ack"; success: boolean }
	| { type: "vault-clipboard-ack"; success: boolean };

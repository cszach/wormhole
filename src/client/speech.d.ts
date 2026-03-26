/* eslint-disable @typescript-eslint/consistent-type-definitions, no-var */

interface SpeechRecognitionEvent extends Event {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
}

declare var SpeechRecognition: {
	new (): SpeechRecognition;
};

interface Window {
	SpeechRecognition?: typeof SpeechRecognition;
	webkitSpeechRecognition?: typeof SpeechRecognition;
}

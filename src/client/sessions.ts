import { state } from "./state.js";
import {
	sessionBtn,
	sessionModal,
	sessionList,
	sessionNewName,
	sessionCreateBtn,
	sessionError,
	modalPing,
	modalPingValue,
	sessionNameEl,
	sessionHint,
	refreshBtn,
	wormholingRefresh
} from "./dom.js";
import { PING_GOOD_MS, PING_WARN_MS } from "./ping.js";

export function updateSessionHint(): void {
	const count = state.readySessions.size;

	if (count === 0) {
		sessionHint.textContent = "Tap to switch";
		sessionHint.classList.remove("has-ready");
	} else {
		const label =
			count === 1 ? "1 other session ready" : `${count} other sessions ready`;
		sessionHint.textContent = label;
		sessionHint.classList.add("has-ready");
	}
}

async function fetchSessions(): Promise<string[]> {
	try {
		const res = await fetch("/api/sessions");
		const data = await res.json();

		return data.sessions ?? [];
	} catch {
		return [];
	}
}

function renderSessionList(sessions: string[]): void {
	sessionList.innerHTML = "";
	const current = sessionNameEl.textContent ?? "";
	const canDelete = sessions.length > 1;

	for (const name of sessions) {
		const row = document.createElement("div");
		row.className = "session-item";

		if (name === current) {
			row.classList.add("active");
		}

		if (state.readySessions.has(name)) {
			const dot = document.createElement("span");
			dot.className = "session-ready-dot";
			row.appendChild(dot);
		}

		const label = document.createElement("button");
		label.className = "session-item-name";
		label.textContent = name;

		label.addEventListener("click", () => {
			if (
				name !== current &&
				state.ws &&
				state.ws.readyState === WebSocket.OPEN
			) {
				state.readySessions.delete(name);
				updateSessionHint();
				state.ws.send(JSON.stringify({ type: "switch", session: name }));
			}

			closeSessionModal();
		});

		row.appendChild(label);

		const del = document.createElement("button");
		del.className = "session-delete";
		del.textContent = "\u00d7";
		del.title = "Delete session";
		del.setAttribute("aria-label", "Delete session");
		del.disabled = !canDelete;

		del.addEventListener("click", async (event) => {
			event.stopPropagation();

			try {
				const res = await fetch("/api/sessions/" + encodeURIComponent(name), {
					method: "DELETE"
				});

				if (!res.ok) {
					const data = await res.json();
					sessionError.textContent = data.error ?? "Failed to delete";
					sessionError.hidden = false;

					return;
				}

				const updated = await fetchSessions();
				renderSessionList(updated);
			} catch {
				sessionError.textContent = "Failed to delete session";
				sessionError.hidden = false;
			}
		});

		row.appendChild(del);
		sessionList.appendChild(row);
	}
}

async function openSessionModal(): Promise<void> {
	sessionError.hidden = true;
	sessionNewName.value = "";
	sessionModal.hidden = false;

	if (state.latencyMs >= 0) {
		modalPingValue.textContent = `${state.latencyMs}ms`;
		modalPing.classList.remove("ping-good", "ping-warn", "ping-poor");
		if (state.latencyMs <= PING_GOOD_MS) {
			modalPing.classList.add("ping-good");
		} else if (state.latencyMs <= PING_WARN_MS) {
			modalPing.classList.add("ping-warn");
		} else {
			modalPing.classList.add("ping-poor");
		}
		modalPing.hidden = false;
	} else {
		modalPing.hidden = true;
	}

	const sessions = await fetchSessions();
	renderSessionList(sessions);
}

function closeSessionModal(): void {
	sessionModal.hidden = true;
}

export function setupSessionHandlers(): void {
	sessionBtn.addEventListener("click", () => {
		openSessionModal();
	});

	sessionModal.addEventListener("click", (event) => {
		if (event.target === sessionModal) {
			closeSessionModal();
		}
	});

	wormholingRefresh.addEventListener("click", (e) => {
		e.preventDefault();
		location.reload();
	});

	refreshBtn.addEventListener("click", () => {
		location.reload();
	});

	sessionCreateBtn.addEventListener("click", async () => {
		const name = sessionNewName.value.trim();

		if (!name) {
			return;
		}

		sessionError.hidden = true;

		try {
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name })
			});

			if (!res.ok) {
				const data = await res.json();
				sessionError.textContent = data.error ?? "Failed to create session";
				sessionError.hidden = false;

				return;
			}

			if (state.ws && state.ws.readyState === WebSocket.OPEN) {
				state.ws.send(JSON.stringify({ type: "switch", session: name }));
			}

			closeSessionModal();
		} catch {
			sessionError.textContent = "Failed to create session";
			sessionError.hidden = false;
		}
	});

	sessionNewName.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			sessionCreateBtn.click();
		}
	});
}

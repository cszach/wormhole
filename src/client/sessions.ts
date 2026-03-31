import { state } from "./state.js";
import {
	sessionBtn,
	sessionHint,
	refreshBtn,
	wormholingRefresh,
	sdPanel,
	sdBackdrop,
	sdClose,
	sdSearch,
	sdNewSession,
	sdCreate,
	sdCreateInput,
	sdCreateBtn,
	sdError,
	sdList
} from "./dom.js";

// --- Types ---

type WindowInfo = { index: number; name: string; active: boolean };
type SessionInfo = { name: string; windows: WindowInfo[] };

// --- Drawer state ---

let expanded: string | null = null;
let sessions: SessionInfo[] = [];
let currentSession = "";
let currentWindowIndex = 0;

// --- Hint ---

export function updateSessionHint(): void {
	const count = state.readySessions.size;

	if (count > 0) {
		const label =
			count === 1 ? "1 other session ready" : `${count} other sessions ready`;
		sessionHint.textContent = label;
		sessionHint.classList.add("has-ready");
	} else if (state.activeWindowName) {
		sessionHint.textContent = state.activeWindowName;
		sessionHint.classList.remove("has-ready");
	} else {
		sessionHint.textContent = "Tap to switch";
		sessionHint.classList.remove("has-ready");
	}
}

// --- Fetch ---

async function fetchSessions(): Promise<void> {
	try {
		const res = await fetch("/api/sessions");
		const data = await res.json();
		sessions = data.sessions ?? [];
		currentSession = data.activeSession ?? "";
		currentWindowIndex = data.activeWindowIndex ?? 0;
	} catch {
		sessions = [];
	}
}

// --- Navigation ---

function switchTo(session: string, windowIndex?: number): void {
	if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
		return;
	}

	state.readySessions.delete(session);
	updateSessionHint();

	const msg: Record<string, unknown> = { type: "switch", session };
	if (typeof windowIndex === "number") {
		msg.window = windowIndex;
	}
	state.ws.send(JSON.stringify(msg));

	closeDrawer();
}

// --- Swipe-to-reveal ---

function attachSwipe(
	wrapper: HTMLElement,
	content: HTMLElement,
	actionsWidth: number
): void {
	let startX = 0;
	let startY = 0;
	let baseOffset = 0;
	let offsetX = 0;
	let swiping = false;
	let locked = false;

	content.style.touchAction = "pan-y";

	content.addEventListener("pointerdown", (e) => {
		startX = e.clientX;
		startY = e.clientY;
		baseOffset = wrapper.classList.contains("sd-swiped") ? -actionsWidth : 0;
		offsetX = baseOffset;
		swiping = false;
		locked = false;
		content.setPointerCapture(e.pointerId);
		content.style.transition = "none";
	});

	content.addEventListener("pointermove", (e) => {
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!locked) {
			if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
				return;
			}

			if (Math.abs(dy) > Math.abs(dx)) {
				locked = true;
				return;
			}

			locked = true;
			swiping = true;
		}

		if (!swiping) {
			return;
		}

		offsetX = Math.max(-actionsWidth, Math.min(0, baseOffset + dx));
		content.style.transform = `translateX(${offsetX}px)`;
	});

	const settle = () => {
		content.style.transition = "";

		if (swiping && offsetX < -actionsWidth / 3) {
			content.style.transform = `translateX(${-actionsWidth}px)`;
			wrapper.classList.add("sd-swiped");
		} else {
			content.style.transform = "";
			wrapper.classList.remove("sd-swiped");
		}

		swiping = false;
		locked = false;
	};

	content.addEventListener("pointerup", settle);
	content.addEventListener("pointercancel", settle);
}

function closeAllSwipes(): void {
	for (const el of sdList.querySelectorAll<HTMLElement>(".sd-swiped")) {
		el.classList.remove("sd-swiped");
		const content = el.querySelector<HTMLElement>(".sd-swipe-content");
		if (content) {
			content.style.transition = "";
			content.style.transform = "";
		}
	}
}

// --- Inline rename ---

function startRenameSession(name: string, labelEl: HTMLElement): void {
	const input = document.createElement("input");
	input.type = "text";
	input.className = "sd-rename-input";
	input.value = name;
	input.maxLength = 20;

	labelEl.replaceWith(input);
	input.focus();
	input.select();

	const commit = async () => {
		const newName = input.value.trim();
		if (!newName || newName === name) {
			render();
			return;
		}

		try {
			const res = await fetch("/api/sessions/" + encodeURIComponent(name), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newName })
			});

			if (!res.ok) {
				const data = await res.json();
				showError(data.error ?? "Rename failed");
			}
		} catch {
			showError("Rename failed");
		}

		await fetchSessions();
		render();
	};

	input.addEventListener("blur", commit);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			input.blur();
		}
		if (e.key === "Escape") {
			input.removeEventListener("blur", commit);
			render();
		}
	});
}

function startRenameWindow(
	session: string,
	index: number,
	name: string,
	labelEl: HTMLElement
): void {
	const input = document.createElement("input");
	input.type = "text";
	input.className = "sd-rename-input";
	input.value = name;
	input.maxLength = 30;

	labelEl.replaceWith(input);
	input.focus();
	input.select();

	const commit = async () => {
		const newName = input.value.trim();
		if (!newName || newName === name) {
			render();
			return;
		}

		try {
			const res = await fetch(
				`/api/sessions/${encodeURIComponent(session)}/windows/${index}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ newName })
				}
			);

			if (!res.ok) {
				const data = await res.json();
				showError(data.error ?? "Rename failed");
			}
		} catch {
			showError("Rename failed");
		}

		await fetchSessions();
		render();
	};

	input.addEventListener("blur", commit);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			input.blur();
		}
		if (e.key === "Escape") {
			input.removeEventListener("blur", commit);
			render();
		}
	});
}

// --- Delete ---

async function deleteSession(name: string): Promise<void> {
	try {
		const res = await fetch("/api/sessions/" + encodeURIComponent(name), {
			method: "DELETE"
		});

		if (!res.ok) {
			const data = await res.json();
			showError(data.error ?? "Delete failed");
			return;
		}
	} catch {
		showError("Delete failed");
		return;
	}

	await fetchSessions();
	render();
}

async function deleteWindow(session: string, index: number): Promise<void> {
	try {
		const res = await fetch(
			`/api/sessions/${encodeURIComponent(session)}/windows/${index}`,
			{ method: "DELETE" }
		);

		if (!res.ok) {
			const data = await res.json();
			showError(data.error ?? "Delete failed");
			return;
		}
	} catch {
		showError("Delete failed");
		return;
	}

	await fetchSessions();
	render();
}

// --- Create window ---

async function createNewWindow(session: string): Promise<void> {
	try {
		const res = await fetch(
			`/api/sessions/${encodeURIComponent(session)}/windows`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" }
			}
		);

		if (!res.ok) {
			const data = await res.json();
			showError(data.error ?? "Failed to create window");
			return;
		}
	} catch {
		showError("Failed to create window");
		return;
	}

	await fetchSessions();
	render();
}

// --- Error ---

function showError(msg: string): void {
	sdError.textContent = msg;
	sdError.hidden = false;
}

// --- Render ---

const ACTIONS_WIDTH = 120;

function makeActions(
	onRename: () => void,
	onDelete: () => void,
	canDelete: boolean
): HTMLElement {
	const actions = document.createElement("div");
	actions.className = "sd-actions";

	const renameBtn = document.createElement("button");
	renameBtn.type = "button";
	renameBtn.className = "sd-action-btn sd-action-btn--rename";
	renameBtn.textContent = "Rename";
	renameBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		closeAllSwipes();
		onRename();
	});

	const deleteBtn = document.createElement("button");
	deleteBtn.type = "button";
	deleteBtn.className = "sd-action-btn sd-action-btn--delete";
	deleteBtn.textContent = "Delete";
	deleteBtn.disabled = !canDelete;

	if (canDelete) {
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			closeAllSwipes();
			onDelete();
		});
	}

	actions.appendChild(renameBtn);
	actions.appendChild(deleteBtn);
	return actions;
}

function buildWindowList(
	session: SessionInfo,
	windows: WindowInfo[],
	isActive: boolean
): HTMLElement {
	const list = document.createElement("div");
	list.className = "sd-window-list";
	const windowCount = session.windows.length;

	for (const win of windows) {
		const isActiveWindow = isActive && win.index === currentWindowIndex;

		const wrapper = document.createElement("div");
		wrapper.className = "sd-swipe-wrapper";

		const content = document.createElement("div");
		content.className =
			"sd-swipe-content sd-window-row" +
			(isActiveWindow ? " sd-window-active" : "");

		if (isActiveWindow) {
			const bar = document.createElement("span");
			bar.className = "sd-active-bar";
			content.appendChild(bar);
		}

		const idx = document.createElement("span");
		idx.className = "sd-window-index";
		idx.textContent = String(win.index);

		const name = document.createElement("span");
		name.className = "sd-name" + (isActiveWindow ? "" : " sd-name--muted");
		name.textContent = win.name;

		content.appendChild(idx);
		content.appendChild(name);

		content.addEventListener("click", () => {
			closeAllSwipes();
			switchTo(session.name, win.index);
		});

		const actions = makeActions(
			() => startRenameWindow(session.name, win.index, win.name, name),
			() => deleteWindow(session.name, win.index),
			windowCount > 1
		);

		wrapper.appendChild(content);
		wrapper.appendChild(actions);
		attachSwipe(wrapper, content, ACTIONS_WIDTH);
		list.appendChild(wrapper);
	}

	const newWin = document.createElement("button");
	newWin.type = "button";
	newWin.className = "sd-new-window";
	newWin.textContent = "+ New window";
	newWin.addEventListener("click", () => createNewWindow(session.name));
	list.appendChild(newWin);

	return list;
}

function render(): void {
	sdList.innerHTML = "";
	const canDeleteSession = sessions.length > 1;
	const query = sdSearch.value.trim().toLowerCase();

	for (const session of sessions) {
		const sessionMatch = !query || session.name.toLowerCase().includes(query);
		const matchingWindows = query
			? session.windows.filter((w) => w.name.toLowerCase().includes(query))
			: [];

		if (query && !sessionMatch && matchingWindows.length === 0) {
			continue;
		}

		const forceExpand = query && matchingWindows.length > 0;
		const isActive = session.name === currentSession;
		const isExpanded = forceExpand || expanded === session.name;
		const windowCount = session.windows.length;

		const group = document.createElement("div");
		group.className = "sd-session";

		const wrapper = document.createElement("div");
		wrapper.className = "sd-swipe-wrapper";

		const content = document.createElement("div");
		content.className = "sd-swipe-content";

		if (isActive) {
			const bar = document.createElement("span");
			bar.className = "sd-active-bar";
			content.appendChild(bar);
		}

		if (state.readySessions.has(session.name)) {
			const dot = document.createElement("span");
			dot.className = "sd-ready-dot";
			content.appendChild(dot);
		}

		const label = document.createElement("span");
		label.className = "sd-name" + (isActive ? "" : " sd-name--muted");
		label.textContent = session.name;

		const count = document.createElement("span");
		count.className = "sd-window-count";
		count.textContent =
			windowCount === 1 ? "1 window" : `${windowCount} windows`;

		const chevron = document.createElement("span");
		chevron.className = "sd-chevron" + (isExpanded ? " expanded" : "");
		chevron.innerHTML =
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
			' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
			'<polyline points="9 18 15 12 9 6"/></svg>';

		content.appendChild(label);
		content.appendChild(count);
		if (windowCount > 1) {
			content.appendChild(chevron);
		}

		content.addEventListener("click", () => {
			closeAllSwipes();
			if (windowCount === 1) {
				switchTo(session.name, session.windows[0].index);
			} else {
				expanded = isExpanded ? null : session.name;
				render();
			}
		});

		const actions = makeActions(
			() => startRenameSession(session.name, label),
			() => deleteSession(session.name),
			canDeleteSession
		);

		wrapper.appendChild(content);
		wrapper.appendChild(actions);
		attachSwipe(wrapper, content, ACTIONS_WIDTH);
		group.appendChild(wrapper);

		if (isExpanded && windowCount > 1) {
			const visibleWindows =
				matchingWindows.length > 0 ? matchingWindows : session.windows;
			group.appendChild(buildWindowList(session, visibleWindows, isActive));
		}

		sdList.appendChild(group);
	}
}

// --- Open / Close ---

async function openDrawer(): Promise<void> {
	sdError.hidden = true;
	sdCreate.hidden = true;
	sdSearch.value = "";
	sdPanel.hidden = false;
	sdList.innerHTML = '<div class="fb-empty">Loading\u2026</div>';

	await fetchSessions();
	render();
}

function closeDrawer(): void {
	sdPanel.hidden = true;
	expanded = null;
}

// --- Create session ---

async function createNewSession(): Promise<void> {
	const name = sdCreateInput.value.trim();
	if (!name) {
		return;
	}

	sdError.hidden = true;

	try {
		const res = await fetch("/api/sessions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name })
		});

		if (!res.ok) {
			const data = await res.json();
			showError(data.error ?? "Failed to create session");
			return;
		}

		sdCreateInput.value = "";
		sdCreate.hidden = true;
		switchTo(name);
	} catch {
		showError("Failed to create session");
	}
}

// --- Setup ---

export function setupSessionHandlers(): void {
	sessionBtn.addEventListener("click", () => openDrawer());
	sdClose.addEventListener("click", () => closeDrawer());
	sdBackdrop.addEventListener("click", () => closeDrawer());

	sdNewSession.addEventListener("click", () => {
		sdCreate.hidden = !sdCreate.hidden;
		if (!sdCreate.hidden) {
			sdCreateInput.value = "";
			sdCreateInput.focus();
		}
	});

	sdCreateBtn.addEventListener("click", () => createNewSession());
	sdCreateInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			createNewSession();
		}
	});

	sdSearch.addEventListener("input", () => render());

	wormholingRefresh.addEventListener("click", (e) => {
		e.preventDefault();
		location.reload();
	});

	refreshBtn.addEventListener("click", () => location.reload());

	// Close swipes on outside tap
	sdList.addEventListener("click", (e) => {
		if (e.target === sdList) {
			closeAllSwipes();
		}
	});
}

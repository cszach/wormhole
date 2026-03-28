import { skillsChips, skillsAdd, skillsSync } from "./dom.js";

export type Command = {
	name: string;
	desc: string;
	section: string;
};

export function getSkills(): string[] {
	const raw = localStorage.getItem("wormhole-skills") ?? "";

	return raw
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function saveSkills(skills: string[]): void {
	localStorage.setItem("wormhole-skills", skills.join("\n"));
}

export function renderSkillChips(): void {
	skillsChips.innerHTML = "";

	for (const skill of getSkills()) {
		const chip = document.createElement("span");
		chip.className = "chip";

		const label = document.createElement("span");
		label.textContent = skill;

		const remove = document.createElement("button");
		remove.className = "chip-remove";
		remove.textContent = "\u00D7";
		remove.setAttribute("aria-label", "Remove " + skill);

		remove.addEventListener("click", () => {
			const skills = getSkills().filter((s) => s !== skill);
			saveSkills(skills);
			renderSkillChips();
		});

		chip.appendChild(label);
		chip.appendChild(remove);
		skillsChips.appendChild(chip);
	}
}

export function getSkillCommands(): Command[] {
	return getSkills().map((s) => ({
		name: "/" + s,
		desc: "",
		section: "Skills"
	}));
}

async function syncSkills(): Promise<void> {
	skillsSync.disabled = true;
	skillsSync.textContent = "Syncing\u2026";

	try {
		const res = await fetch("/api/skills");
		const data = await res.json();
		const remote: string[] = data.skills ?? [];
		const local = getSkills();
		let added = 0;

		for (const skill of remote) {
			if (!local.includes(skill)) {
				local.push(skill);
				added++;
			}
		}

		if (added > 0) {
			saveSkills(local);
			renderSkillChips();
		}

		const label = added > 1 ? "skills" : "skill";
		skillsSync.textContent =
			added > 0 ? `Synced ${added} new ${label}` : "Already up to date";
	} catch {
		skillsSync.textContent = "Sync failed";
	}

	setTimeout(() => {
		skillsSync.textContent = "Sync from Claude Code";
		skillsSync.disabled = false;
	}, 2000);
}

export function setupSkillHandlers(): void {
	skillsSync.addEventListener("click", syncSkills);

	skillsAdd.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();

			const val = skillsAdd.value.trim();

			if (!val) {
				return;
			}

			const skills = getSkills();

			if (!skills.includes(val)) {
				skills.push(val);
				saveSkills(skills);
				renderSkillChips();
			}

			skillsAdd.value = "";
		}
	});
}

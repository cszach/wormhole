import { skillsChips, skillsAdd } from "./dom.js";

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

export function setupSkillHandlers(): void {
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

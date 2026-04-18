import type { SkillFile } from "../../skill-io.js";
import type { LintFinding } from "../types.js";

export function checkDeprecation(file: SkillFile): LintFinding[] {
	if (file.status !== "deprecated") {
		return [];
	}

	return [
		{
			file: file.path,
			field: "deprecated",
			level: "warning",
			message: file.deprecatedMessage
				? `Skill is deprecated: ${file.deprecatedMessage}`
				: "Skill is deprecated",
			fixable: false,
		},
	];
}

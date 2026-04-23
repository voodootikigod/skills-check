import type { SkillFile } from "../../skill-io.js";
import type { LintFinding } from "../types.js";

/**
 * Check always-required frontmatter fields.
 *
 * These fields are required by the Agent Skills spec for any SKILL.md file:
 * - name: must be a non-empty string, max 64 characters (spec limit)
 * - description: must be a non-empty string, 1-1024 characters (spec limit)
 */
export function checkRequired(file: SkillFile): LintFinding[] {
	const findings: LintFinding[] = [];
	const fm = file.frontmatter;

	// name
	if (!fm.name || (typeof fm.name === "string" && fm.name.trim() === "")) {
		findings.push({
			file: file.path,
			field: "name",
			level: "error",
			message: "Missing required field: name",
			fixable: false,
		});
	} else if (typeof fm.name !== "string") {
		findings.push({
			file: file.path,
			field: "name",
			level: "error",
			message: `Field 'name' must be a string, got ${typeof fm.name}`,
			fixable: false,
		});
	} else if (fm.name.length > 64) {
		findings.push({
			file: file.path,
			field: "name",
			level: "error",
			message: `Field 'name' exceeds maximum length of 64 characters (${fm.name.length})`,
			fixable: false,
		});
	}

	// description
	if (!fm.description || (typeof fm.description === "string" && fm.description.trim() === "")) {
		findings.push({
			file: file.path,
			field: "description",
			level: "error",
			message: "Missing required field: description",
			fixable: false,
		});
	} else if (typeof fm.description === "string") {
		const descLen = fm.description.trim().length;
		if (descLen > 1024) {
			findings.push({
				file: file.path,
				field: "description",
				level: "error",
				message: `Field 'description' exceeds maximum length of 1024 characters (${descLen})`,
				fixable: false,
			});
		}
	} else {
		findings.push({
			file: file.path,
			field: "description",
			level: "error",
			message: `Field 'description' must be a string, got ${typeof fm.description}`,
			fixable: false,
		});
	}

	return findings;
}

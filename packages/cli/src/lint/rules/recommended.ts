import type { SkillFile } from "../../skill-io.js";
import { resolveField } from "../field-resolver.js";
import type { LintFinding } from "../types.js";

/**
 * Check recommended frontmatter fields.
 *
 * These fields are not required but improve discoverability and tooling:
 * - spec-version: which version of the Agent Skills spec the skill conforms to
 * - keywords: discovery tags (array with at least 1 item)
 *
 * Fields are resolved from both top-level and metadata locations.
 */
export function checkRecommended(file: SkillFile): LintFinding[] {
	const findings: LintFinding[] = [];
	const fm = file.frontmatter;

	// spec-version — resolve from top-level or metadata
	const specVersion = resolveField(fm, "spec-version");
	if (!specVersion) {
		findings.push({
			file: file.path,
			field: "spec-version",
			level: "info",
			message: "Missing recommended field: spec-version",
			fixable: false,
		});
	} else if (typeof specVersion !== "string") {
		findings.push({
			file: file.path,
			field: "spec-version",
			level: "info",
			message: `Field 'spec-version' should be a string, got ${typeof specVersion}`,
			fixable: false,
		});
	}

	// keywords — resolve from top-level or metadata
	const keywords = resolveField(fm, "keywords");
	if (!keywords) {
		findings.push({
			file: file.path,
			field: "keywords",
			level: "info",
			message: "Missing recommended field: keywords",
			fixable: false,
		});
	} else if (!Array.isArray(keywords)) {
		findings.push({
			file: file.path,
			field: "keywords",
			level: "info",
			message: `Field 'keywords' should be an array, got ${typeof keywords}`,
			fixable: false,
		});
	} else if (keywords.length === 0) {
		findings.push({
			file: file.path,
			field: "keywords",
			level: "info",
			message: "Field 'keywords' is empty; add at least one keyword for discoverability",
			fixable: false,
		});
	}

	return findings;
}

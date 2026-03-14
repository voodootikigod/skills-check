import type { SkillFile } from "../../skill-io.js";
import { resolveField } from "../field-resolver.js";
import { isValidSpdx } from "../spdx.js";
import type { LintFinding } from "../types.js";

/**
 * Check fields required for publishing a skill to a registry.
 *
 * These fields are required for `npx skills publish`:
 * - author: non-empty string (fixable via git config)
 * - license: valid SPDX identifier (fixable with MIT default)
 * - repository: valid URL (fixable via git remote)
 *
 * Fields are resolved from both top-level and metadata locations.
 */
export function checkPublishReady(file: SkillFile): LintFinding[] {
	const findings: LintFinding[] = [];
	const fm = file.frontmatter;

	// author — resolve from top-level or metadata
	const author = resolveField(fm, "author");
	if (!author || (typeof author === "string" && author.trim() === "")) {
		findings.push({
			file: file.path,
			field: "author",
			level: "error",
			message: "Missing required field for publish: author",
			fixable: true,
		});
	} else if (typeof author !== "string") {
		findings.push({
			file: file.path,
			field: "author",
			level: "error",
			message: `Field 'author' must be a string, got ${typeof author}`,
			fixable: false,
		});
	}

	// license — spec allows any string, but SPDX is required for npm publishing
	const license = resolveField(fm, "license");
	if (!license || (typeof license === "string" && license.trim() === "")) {
		findings.push({
			file: file.path,
			field: "license",
			level: "error",
			message: "Missing required field for publish: license",
			fixable: true,
		});
	} else if (typeof license === "string" && !isValidSpdx(license)) {
		findings.push({
			file: file.path,
			field: "license",
			level: "warning",
			message: `License "${license}" is not a recognized SPDX identifier. Valid SPDX is recommended for npm publishing.`,
			fixable: false,
		});
	}

	// repository — resolve from top-level or metadata
	const repository = resolveField(fm, "repository");
	if (!repository || (typeof repository === "string" && repository.trim() === "")) {
		findings.push({
			file: file.path,
			field: "repository",
			level: "error",
			message: "Missing required field for publish: repository",
			fixable: true,
		});
	} else if (typeof repository === "string") {
		try {
			new URL(repository);
		} catch {
			findings.push({
				file: file.path,
				field: "repository",
				level: "error",
				message: `Field 'repository' is not a valid URL: "${repository}"`,
				fixable: false,
			});
		}
	}

	return findings;
}

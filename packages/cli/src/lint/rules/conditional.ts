import { extractVersionedPackages, parseCompatibility } from "../../compatibility/index.js";
import type { SkillFile } from "../../skill-io.js";
import { detectsAgentSpecific } from "../detection/agent-specific.js";
import { detectsProduct } from "../detection/product-refs.js";
import { resolveField } from "../field-resolver.js";
import type { LintFinding } from "../types.js";

/**
 * Check conditionally required frontmatter fields.
 *
 * These fields are required only when the skill content indicates they are relevant:
 * - compatibility or product-version: required if the skill references a specific product
 * - agents: required if the skill contains agent-specific instructions
 *
 * Fields are resolved from both top-level and metadata locations.
 */
export function checkConditional(file: SkillFile): LintFinding[] {
	const findings: LintFinding[] = [];
	const fm = file.frontmatter;

	// Version tracking: accept compatibility (with versioned entries) OR product-version
	const hasProductVersion = !!resolveField(fm, "product-version");
	const hasVersionedCompatibility =
		typeof fm.compatibility === "string" &&
		extractVersionedPackages(parseCompatibility(fm.compatibility)).length > 0;

	if (!(hasProductVersion || hasVersionedCompatibility) && detectsProduct(file.content)) {
		findings.push({
			file: file.path,
			field: "compatibility",
			level: "warning",
			message:
				"Skill references a product but is missing 'compatibility' or 'product-version' in frontmatter",
			fixable: false,
		});
	}

	// Deprecation notice: product-version without compatibility
	if (hasProductVersion && !hasVersionedCompatibility) {
		findings.push({
			file: file.path,
			field: "product-version",
			level: "info",
			message:
				"Consider migrating from 'product-version' to the spec-native 'compatibility' field (e.g., compatibility: \"package@version\")",
			fixable: false,
		});
	}

	// agents: required if content has agent-specific instructions — resolve from both locations
	const agents = resolveField(fm, "agents");
	if (!agents && detectsAgentSpecific(file.content)) {
		findings.push({
			file: file.path,
			field: "agents",
			level: "warning",
			message: "Skill contains agent-specific instructions but is missing 'agents' in frontmatter",
			fixable: false,
		});
	}

	return findings;
}

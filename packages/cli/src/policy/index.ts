import { stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { PolicyExemption } from "@skills-check/schema";
import { discoverSkillFiles } from "../shared/discovery.js";
import type { SkillFile } from "../skill-io.js";
import { readSkillFile } from "../skill-io.js";
import type {
	PolicyExemptedViolation,
	PolicyFinding,
	PolicyOptions,
	PolicyReport,
	SkillPolicy,
} from "./types.js";
import { checkAuditClean } from "./validators/audit-integration.js";
import { checkBanned } from "./validators/banned.js";
import { checkContent } from "./validators/content.js";
import { checkFreshness } from "./validators/freshness.js";
import { checkMetadata } from "./validators/metadata.js";
import { checkRequired } from "./validators/required.js";
import { checkSources } from "./validators/sources.js";

function escapeRegex(value: string): string {
	return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function matchesSkillPattern(skill: string, pattern: string): boolean {
	const regexPattern = escapeRegex(
		pattern
			.replaceAll("**", "__DOUBLE_STAR__")
			.replaceAll("*", "__SINGLE_STAR__")
			.replaceAll("?", "__QUESTION_MARK__")
	)
		.replaceAll("__DOUBLE_STAR__", ".*")
		.replaceAll("__SINGLE_STAR__", "[^/]*")
		.replaceAll("__QUESTION_MARK__", "[^/]");

	return new RegExp(`^${regexPattern}$`).test(skill);
}

function normalizeExpiryDate(expires: string): number | null {
	if (/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
		return Date.parse(`${expires}T23:59:59.999Z`);
	}

	const parsed = Date.parse(expires);
	return Number.isFinite(parsed) ? parsed : null;
}

function getSkillName(file: SkillFile): string | undefined {
	const frontmatterName = file.frontmatter.name;
	if (typeof frontmatterName === "string" && frontmatterName.length > 0) {
		return frontmatterName;
	}

	const directoryName = basename(dirname(file.path));
	return directoryName.length > 0 ? directoryName : undefined;
}

function attachSkill(findings: PolicyFinding[], skill: string | undefined): PolicyFinding[] {
	if (!skill) {
		return findings;
	}

	return findings.map((finding) => ({
		...finding,
		skill,
	}));
}

function withExpiredExemptionWarning(
	finding: PolicyFinding,
	exemption: PolicyExemption
): PolicyFinding {
	const warning = `Exemption expired on ${exemption.expires}: ${exemption.reason}`;
	return {
		...finding,
		detail: finding.detail ? `${finding.detail}\n${warning}` : warning,
	};
}

export function applyExemptions(
	violations: PolicyFinding[],
	exemptions: PolicyExemption[],
	now = new Date()
): { active: PolicyFinding[]; exempted: PolicyExemptedViolation[] } {
	if (exemptions.length === 0) {
		return { active: violations, exempted: [] };
	}

	const active: PolicyFinding[] = [];
	const exempted: PolicyExemptedViolation[] = [];

	for (const violation of violations) {
		const matchingExemption = exemptions.find((exemption) => {
			if (!violation.skill) {
				return false;
			}

			return exemption.rule === violation.rule && matchesSkillPattern(violation.skill, exemption.skill);
		});

		if (!matchingExemption) {
			active.push(violation);
			continue;
		}

		if (matchingExemption.expires) {
			const expiry = normalizeExpiryDate(matchingExemption.expires);
			if (expiry !== null && expiry < now.getTime()) {
				active.push(withExpiredExemptionWarning(violation, matchingExemption));
				continue;
			}
		}

		exempted.push({
			...violation,
			exemption: matchingExemption,
		});
	}

	return { active, exempted };
}

/**
 * Run a policy check against discovered skill files.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator function
export async function runPolicyCheck(
	paths: string[],
	policy: SkillPolicy,
	policyFile: string,
	options: PolicyOptions = {}
): Promise<PolicyReport> {
	// Discover all skill files
	const allFiles: string[] = [];
	for (const p of paths) {
		try {
			const info = await stat(p);
			if (info.isDirectory()) {
				const discovered = await discoverSkillFiles(p);
				allFiles.push(...discovered);
			} else if (p.endsWith(".md")) {
				allFiles.push(p);
			}
		} catch {
			throw new Error(`Cannot access path: ${p}`);
		}
	}

	// Filter by skill name if specified
	let filesToCheck = allFiles;
	if (options.skill) {
		const skillFilter = options.skill;
		// We need to read files to check the name, so read all first
		const readFiles: SkillFile[] = [];
		for (const filePath of allFiles) {
			const sf = await readSkillFile(filePath);
			readFiles.push(sf);
		}
		const matchingFiles = readFiles.filter((sf) => sf.frontmatter.name === skillFilter);
		if (matchingFiles.length === 0) {
			// Fall back to path matching
			filesToCheck = allFiles.filter((f) => f.toLowerCase().includes(skillFilter.toLowerCase()));
		} else {
			filesToCheck = matchingFiles.map((sf) => sf.path);
		}
	}

	const allFindings: PolicyFinding[] = [];
	const skillFiles: SkillFile[] = [];
	const skillNameByPath = new Map<string, string>();

	// Read and validate each skill file
	for (const filePath of filesToCheck) {
		const sf = await readSkillFile(filePath);
		skillFiles.push(sf);
		const skillName = getSkillName(sf);
		if (skillName) {
			skillNameByPath.set(sf.path, skillName);
		}

		// Run per-file validators
		allFindings.push(...attachSkill(checkSources(sf, policy), skillName));
		allFindings.push(...attachSkill(checkBanned(sf, policy), skillName));
		allFindings.push(...attachSkill(checkMetadata(sf, policy), skillName));
		allFindings.push(...attachSkill(checkContent(sf, policy), skillName));
		allFindings.push(...attachSkill(checkFreshness(sf, policy), skillName));
	}

	// Check required skills (across all discovered files, not just filtered)
	let allSkillFiles = skillFiles;
	if (options.skill) {
		// For required check, always use all discovered files
		allSkillFiles = [];
		for (const filePath of allFiles) {
			allSkillFiles.push(await readSkillFile(filePath));
		}
	}
	const required = checkRequired(allSkillFiles, policy);

	// Add findings for unsatisfied required skills
	for (const req of required) {
		if (!req.satisfied) {
			allFindings.push({
				file: "<project>",
				severity: "violation",
				rule: "required",
				message: `Required skill "${req.skill}" is not installed`,
				skill: req.skill,
			});
		}
	}

	// Audit integration (only if paths are provided and audit required)
	if (policy.audit?.require_clean) {
		const auditFindings = await checkAuditClean(paths, policy);
		allFindings.push(
			...auditFindings.map((finding) => ({
				...finding,
				skill: skillNameByPath.get(finding.file),
			}))
		);
	}

	const { active, exempted } = applyExemptions(allFindings, policy.exemptions ?? []);

	// Compute summary
	const summary = {
		blocked: active.filter((f) => f.severity === "blocked").length,
		violations: active.filter((f) => f.severity === "violation").length,
		warnings: active.filter((f) => f.severity === "warning").length,
	};

	return {
		exemptedViolations: exempted,
		exemptions: policy.exemptions ?? [],
		policyFile,
		files: filesToCheck.length,
		findings: active,
		required,
		showExemptions: options.showExemptions,
		summary,
		generatedAt: new Date().toISOString(),
	};
}

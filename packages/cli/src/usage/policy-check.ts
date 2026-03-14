import { discoverPolicyFile, loadPolicyFile } from "../policy/parser.js";
import type { UsageReport } from "./analyzer.js";

export interface UsagePolicyViolation {
	callCount: number;
	message: string;
	rule: string;
	severity: "critical" | "high" | "medium";
	skill: string;
	version: string;
}

/**
 * Cross-reference usage data against .skill-policy.yml.
 * Returns violations found in runtime telemetry.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator function
export async function checkUsagePolicy(
	report: UsageReport,
	policyPath?: string
): Promise<UsagePolicyViolation[]> {
	// Find policy file
	const resolvedPath = policyPath ?? (await discoverPolicyFile(process.cwd()));
	if (!resolvedPath) {
		return [];
	}

	let policy: Awaited<ReturnType<typeof loadPolicyFile>>;
	try {
		policy = await loadPolicyFile(resolvedPath);
	} catch {
		return [];
	}

	const violations: UsagePolicyViolation[] = [];

	for (const skill of report.skills) {
		// Check banned skills
		if (policy.banned) {
			for (const ban of policy.banned) {
				if (skill.name === ban.skill || skill.name.includes(ban.skill)) {
					violations.push({
						skill: skill.name,
						version: skill.versions.join(", "),
						rule: "banned",
						severity: "critical",
						message: `Banned skill "${skill.name}" detected in ${skill.totalCalls} API calls${ban.reason ? `: ${ban.reason}` : ""}`,
						callCount: skill.totalCalls,
					});
				}
			}
		}

		// Check source deny list
		if (policy.sources?.deny) {
			for (const denied of policy.sources.deny) {
				// Match against skill name patterns (glob-like)
				if (skill.name.startsWith(denied.replace("*", ""))) {
					violations.push({
						skill: skill.name,
						version: skill.versions.join(", "),
						rule: "source-denied",
						severity: "high",
						message: `Skill "${skill.name}" from denied source pattern "${denied}" used ${skill.totalCalls} times`,
						callCount: skill.totalCalls,
					});
				}
			}
		}
	}

	// Sort by severity (critical first) then call count
	const severityOrder = { critical: 0, high: 1, medium: 2 };
	violations.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.callCount - a.callCount
	);

	return violations;
}

import { describe, expect, it } from "vitest";
import type { PolicyFinding, PolicyReport } from "../types.ts";
import { formatPolicyJson } from "./json.ts";

function makeReport(
	findings: PolicyFinding[],
	required: PolicyReport["required"] = []
): PolicyReport {
	return {
		policyFile: ".skill-policy.yml",
		files: 2,
		findings,
		required,
		summary: {
			blocked: findings.filter((finding) => finding.severity === "blocked").length,
			violations: findings.filter((finding) => finding.severity === "violation").length,
			warnings: findings.filter((finding) => finding.severity === "warning").length,
		},
		generatedAt: "2026-04-18T12:00:00.000Z",
	};
}

describe("formatPolicyJson snapshots", () => {
	it("renders clean output", () => {
		const report = makeReport([], [{ skill: "security-review", satisfied: true }]);

		expect(formatPolicyJson(report)).toMatchSnapshot();
	});

	it("renders multiple violations", () => {
		const report = makeReport([
			{
				file: "skills/internal/deploy/SKILL.md",
				severity: "violation",
				rule: "content.deny_patterns",
				message: "Contains denied pattern: exec",
				detail: "Runtime shell execution is not allowed.",
				line: 14,
			},
			{
				file: "skills/internal/deploy/SKILL.md",
				severity: "violation",
				rule: "content.require_patterns",
				message: "Missing required pattern: rollback",
				detail: "Deployment skills must document rollback steps.",
			},
		]);

		expect(formatPolicyJson(report)).toMatchSnapshot();
	});

	it("renders mixed severities", () => {
		const report = makeReport(
			[
				{
					file: "skills/vendor/rogue/SKILL.md",
					severity: "blocked",
					rule: "sources.deny",
					message: 'Source "evil/skills" is in the deny list',
				},
				{
					file: "skills/internal/deploy/SKILL.md",
					severity: "violation",
					rule: "content.deny_patterns",
					message: "Contains denied pattern: exec",
					detail: "Runtime shell execution is not allowed.",
					line: 14,
				},
				{
					file: "skills/internal/legacy/SKILL.md",
					severity: "warning",
					rule: "freshness.max_age_days",
					message: "Last verified 142 days ago",
					detail: "Review the upstream changelog.",
				},
			],
			[{ skill: "incident-response", satisfied: false }]
		);

		expect(formatPolicyJson(report)).toMatchSnapshot();
	});
});

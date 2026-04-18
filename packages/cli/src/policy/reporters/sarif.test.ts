import { describe, expect, it } from "vitest";
import type { PolicyFinding, PolicyReport } from "../types.ts";
import { formatPolicySarif } from "./sarif.ts";

interface SarifLog {
	$schema: string;
	runs: Array<{
		invocations: Array<{ endTimeUtc: string; executionSuccessful: boolean }>;
		results: Array<{
			level: "error" | "warning" | "note";
			locations: Array<{
				physicalLocation: {
					artifactLocation: { uri: string };
					region: { startLine: number };
				};
			}>;
			message: { text: string };
			properties: { detail?: string; severity: string };
			ruleId: string;
		}>;
		tool: {
			driver: {
				informationUri: string;
				name: string;
				rules: Array<{
					defaultConfiguration: { level: "error" | "warning" | "note" };
					id: string;
					shortDescription: { text: string };
				}>;
			};
		};
	}>;
	version: "2.1.0";
}

const SARIF_TIMESTAMP_RE = /^2026-04-18T12:00:00.000Z$/;
const SARIF_RULE_ID_RE = /^skills-check\/policy\//;

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

function parseSarif(report: PolicyReport): SarifLog {
	return JSON.parse(formatPolicySarif(report)) as SarifLog;
}

function validateSarif21Structure(sarif: SarifLog): void {
	if (sarif.version !== "2.1.0") {
		throw new Error(`Unexpected SARIF version: ${sarif.version}`);
	}
	if (sarif.$schema !== "https://json.schemastore.org/sarif-2.1.0.json") {
		throw new Error(`Unexpected SARIF schema: ${sarif.$schema}`);
	}
	if (sarif.runs.length !== 1) {
		throw new Error(`Expected one SARIF run, got ${sarif.runs.length}`);
	}

	const [run] = sarif.runs;
	if (run.tool.driver.name !== "skills-check/policy") {
		throw new Error(`Unexpected tool name: ${run.tool.driver.name}`);
	}
	if (run.tool.driver.informationUri !== "https://skillscheck.ai") {
		throw new Error(`Unexpected tool URI: ${run.tool.driver.informationUri}`);
	}
	if (run.invocations.length !== 1) {
		throw new Error(`Expected one invocation, got ${run.invocations.length}`);
	}
	if (!run.invocations[0].executionSuccessful) {
		throw new Error("Expected successful SARIF invocation");
	}
	if (!SARIF_TIMESTAMP_RE.test(run.invocations[0].endTimeUtc)) {
		throw new Error(`Unexpected invocation timestamp: ${run.invocations[0].endTimeUtc}`);
	}

	for (const result of run.results) {
		if (!SARIF_RULE_ID_RE.test(result.ruleId)) {
			throw new Error(`Unexpected rule id: ${result.ruleId}`);
		}
		if (!["error", "warning", "note"].includes(result.level)) {
			throw new Error(`Unexpected SARIF level: ${result.level}`);
		}
		if (result.locations.length !== 1) {
			throw new Error(`Expected one location for ${result.ruleId}`);
		}
		if (result.locations[0].physicalLocation.artifactLocation.uri.length === 0) {
			throw new Error(`Missing artifact URI for ${result.ruleId}`);
		}
		if (result.locations[0].physicalLocation.region.startLine < 1) {
			throw new Error(`Invalid start line for ${result.ruleId}`);
		}
		if (result.message.text.length === 0) {
			throw new Error(`Missing message text for ${result.ruleId}`);
		}
		if (!["blocked", "violation", "warning"].includes(result.properties.severity)) {
			throw new Error(`Unexpected severity property: ${result.properties.severity}`);
		}
	}

	const ruleIds = run.tool.driver.rules.map((rule) => rule.id);
	if (new Set(ruleIds).size !== ruleIds.length) {
		throw new Error("Expected SARIF rules to be unique");
	}
}

describe("formatPolicySarif", () => {
	it("renders clean SARIF snapshot", () => {
		const report = makeReport([], [{ skill: "security-review", satisfied: true }]);
		const sarif = parseSarif(report);

		expect(() => validateSarif21Structure(sarif)).not.toThrow();
		expect(formatPolicySarif(report)).toMatchSnapshot();
	});

	it("renders multiple violations SARIF snapshot", () => {
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
		const sarif = parseSarif(report);

		expect(() => validateSarif21Structure(sarif)).not.toThrow();
		expect(sarif.runs[0].results).toHaveLength(2);
		expect(formatPolicySarif(report)).toMatchSnapshot();
	});

	it("renders mixed severities with SARIF 2.1.0 level mapping", () => {
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
		const sarif = parseSarif(report);

		expect(() => validateSarif21Structure(sarif)).not.toThrow();
		expect(sarif.runs[0].results.map((result) => result.level)).toEqual([
			"error",
			"warning",
			"note",
		]);
		expect(formatPolicySarif(report)).toMatchSnapshot();
	});
});

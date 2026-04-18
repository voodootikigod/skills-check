import type {
	PolicyExemptedViolation,
	PolicyFinding,
	PolicyReport,
	PolicySeverity,
} from "../types.js";

function toSarifLevel(severity: PolicySeverity): "error" | "warning" | "note" {
	switch (severity) {
		case "blocked":
			return "error";
		case "violation":
			return "warning";
		case "warning":
			return "note";
		default:
			return "note";
	}
}

function buildRules(findings: PolicyFinding[]): object[] {
	const seen = new Set<string>();
	const rules: object[] = [];

	for (const f of findings) {
		const ruleId = `skills-check/policy/${f.rule}`;
		if (!seen.has(ruleId)) {
			seen.add(ruleId);
			rules.push({
				id: ruleId,
				shortDescription: { text: f.rule.replace(/-/g, " ") },
				defaultConfiguration: { level: toSarifLevel(f.severity) },
			});
		}
	}

	return rules;
}

function buildResults(findings: PolicyFinding[], exempted: PolicyExemptedViolation[]): object[] {
	const activeResults = findings.map((f) => ({
		ruleId: `skills-check/policy/${f.rule}`,
		level: toSarifLevel(f.severity),
		message: { text: f.message },
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: f.file },
					region: { startLine: f.line ?? 1 },
				},
			},
		],
		properties: {
			severity: f.severity,
			detail: f.detail,
		},
	}));

	const suppressedResults = exempted.map((f) => ({
		ruleId: `skills-check/policy/${f.rule}`,
		level: toSarifLevel(f.severity),
		message: { text: f.message },
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: f.file },
					region: { startLine: f.line ?? 1 },
				},
			},
		],
		suppressions: [
			{
				kind: "external",
				justification: f.exemption.reason,
			},
		],
		properties: {
			detail: f.detail,
			exempted: true,
			exemption: f.exemption,
			severity: f.severity,
		},
	}));

	return [...activeResults, ...suppressedResults];
}

export function formatPolicySarif(report: PolicyReport): string {
	const exemptedViolations = report.exemptedViolations ?? [];
	const allFindings: PolicyFinding[] = [...report.findings, ...exemptedViolations];
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/policy",
						informationUri: "https://skillscheck.ai",
						rules: buildRules(allFindings),
					},
				},
				results: buildResults(report.findings, exemptedViolations),
				invocations: [
					{
						executionSuccessful: true,
						endTimeUtc: report.generatedAt,
					},
				],
			},
		],
	};

	return JSON.stringify(sarif, null, 2);
}

import type { PolicyFinding, PolicyReport, PolicySeverity } from "../types.js";

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

function buildResults(findings: PolicyFinding[]): object[] {
	return findings.map((f) => ({
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
}

export function formatPolicySarif(report: PolicyReport): string {
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/policy",
						informationUri: "https://skillscheck.ai",
						rules: buildRules(report.findings),
					},
				},
				results: buildResults(report.findings),
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

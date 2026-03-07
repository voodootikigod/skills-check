import type { LintFinding, LintReport } from "../types.js";

function toSarifLevel(level: LintFinding["level"]): "error" | "warning" | "note" {
	switch (level) {
		case "error":
			return "error";
		case "warning":
			return "warning";
		case "info":
			return "note";
		default:
			return "note";
	}
}

function buildRules(findings: LintFinding[]): object[] {
	const seen = new Set<string>();
	const rules: object[] = [];

	for (const f of findings) {
		const ruleId = `skills-check/lint/${f.field}`;
		if (!seen.has(ruleId)) {
			seen.add(ruleId);
			rules.push({
				id: ruleId,
				shortDescription: { text: `Lint: ${f.field}` },
				defaultConfiguration: { level: toSarifLevel(f.level) },
			});
		}
	}

	return rules;
}

function buildResults(findings: LintFinding[]): object[] {
	return findings.map((f) => ({
		ruleId: `skills-check/lint/${f.field}`,
		level: toSarifLevel(f.level),
		message: { text: f.message },
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: f.file },
					region: { startLine: 1 },
				},
			},
		],
		properties: {
			field: f.field,
			fixable: f.fixable,
		},
	}));
}

export function formatLintSarif(report: LintReport): string {
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/lint",
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

import type { VerifyReport, VerifyResult } from "../types.js";

function toSarifLevel(result: VerifyResult): "error" | "warning" | "note" {
	return result.match ? "note" : "error";
}

function buildRules(results: VerifyResult[]): object[] {
	const seen = new Set<string>();
	const rules: object[] = [];

	for (const r of results) {
		const ruleId = `skills-check/verify/${r.match ? "pass" : "mismatch"}`;
		if (!seen.has(ruleId)) {
			seen.add(ruleId);
			rules.push({
				id: ruleId,
				shortDescription: {
					text: r.match ? "Version bump matches content" : "Version bump mismatch",
				},
				defaultConfiguration: { level: toSarifLevel(r) },
			});
		}
	}

	return rules;
}

function buildResults(results: VerifyResult[]): object[] {
	return results
		.filter((r) => !r.match)
		.map((r) => ({
			ruleId: "skills-check/verify/mismatch",
			level: "error" as const,
			message: { text: r.explanation },
			locations: [
				{
					physicalLocation: {
						artifactLocation: { uri: r.file },
						region: { startLine: 1 },
					},
				},
			],
			properties: {
				skill: r.skill,
				declaredBump: r.declaredBump,
				assessedBump: r.assessedBump,
				llmUsed: r.llmUsed,
			},
		}));
}

export function formatVerifySarif(report: VerifyReport): string {
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/verify",
						informationUri: "https://skillscheck.ai",
						rules: buildRules(report.results),
					},
				},
				results: buildResults(report.results),
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

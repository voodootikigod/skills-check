import type { BudgetReport } from "../types.js";

function buildRules(report: BudgetReport): object[] {
	const rules: object[] = [];

	if (report.redundancy.length > 0) {
		rules.push({
			id: "skills-check/budget/redundancy",
			shortDescription: { text: "Skill content redundancy detected" },
			defaultConfiguration: { level: "warning" },
		});
	}

	return rules;
}

function buildResults(report: BudgetReport): object[] {
	return report.redundancy.map((r) => ({
		ruleId: "skills-check/budget/redundancy",
		level: "warning" as const,
		message: {
			text: `${r.nameA} and ${r.nameB} share ${Math.round(r.similarity * 100)}% similarity (~${r.overlapTokens} tokens). ${r.suggestion}`,
		},
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: r.skillA },
					region: { startLine: 1 },
				},
			},
		],
		relatedLocations: [
			{
				id: 1,
				physicalLocation: {
					artifactLocation: { uri: r.skillB },
					region: { startLine: 1 },
				},
				message: { text: `Related skill: ${r.nameB}` },
			},
		],
		properties: {
			similarity: r.similarity,
			overlapTokens: r.overlapTokens,
		},
	}));
}

export function formatBudgetSarif(report: BudgetReport): string {
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/budget",
						informationUri: "https://skillscheck.ai",
						rules: buildRules(report),
					},
				},
				results: buildResults(report),
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

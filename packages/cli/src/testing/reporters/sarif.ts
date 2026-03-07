import type { TestReport } from "../types.js";

function buildRules(reports: TestReport[]): object[] {
	const seen = new Set<string>();
	const rules: object[] = [];

	for (const report of reports) {
		for (const c of report.cases) {
			if (!c.passed) {
				const ruleId = `skills-check/test/${c.type}`;
				if (!seen.has(ruleId)) {
					seen.add(ruleId);
					rules.push({
						id: ruleId,
						shortDescription: { text: `Test failure: ${c.type}` },
						defaultConfiguration: { level: "error" },
					});
				}
			}
		}
	}

	return rules;
}

function buildResults(reports: TestReport[]): object[] {
	const results: object[] = [];

	for (const report of reports) {
		for (const c of report.cases) {
			if (!c.passed) {
				const failedGraders = c.trials
					.flatMap((t) => t.graderResults.filter((g) => !g.passed))
					.map((g) => `${g.grader}: ${g.message}`)
					.slice(0, 5);

				results.push({
					ruleId: `skills-check/test/${c.type}`,
					level: "error" as const,
					message: {
						text: `Test "${c.caseId}" failed (pass rate: ${Math.round(c.passRate * 100)}%)${failedGraders.length > 0 ? `. ${failedGraders.join("; ")}` : ""}`,
					},
					locations: [
						{
							physicalLocation: {
								artifactLocation: { uri: report.skillPath },
								region: { startLine: 1 },
							},
						},
					],
					properties: {
						suite: report.suite,
						caseId: c.caseId,
						passRate: c.passRate,
						flaky: c.flaky,
						type: c.type,
					},
				});
			}
		}
	}

	return results;
}

export function formatTestSarif(reports: TestReport[]): string {
	const sarif = {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "skills-check/test",
						informationUri: "https://skillscheck.ai",
						rules: buildRules(reports),
					},
				},
				results: buildResults(reports),
				invocations: [
					{
						executionSuccessful: true,
						endTimeUtc: new Date().toISOString(),
					},
				],
			},
		],
	};

	return JSON.stringify(sarif, null, 2);
}

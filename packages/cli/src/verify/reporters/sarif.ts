import type { IntegrityResult } from "../../lockfile/index.js";
import type { VerifyReport, VerifyResult } from "../types.js";

function toSarifLevel(result: VerifyResult): "error" | "warning" | "note" {
	return result.match ? "note" : "error";
}

function integritySarifLevel(result: IntegrityResult): "error" | "warning" | "note" {
	switch (result.status) {
		case "missing":
			return "error";
		case "modified":
		case "new":
			return "warning";
		default:
			return "note";
	}
}

function integrityRuleId(status: IntegrityResult["status"]): string {
	return `skills-check/integrity/${status}`;
}

function buildRules(report: VerifyReport): object[] {
	const seen = new Set<string>();
	const rules: object[] = [];

	for (const result of report.results) {
		const ruleId = `skills-check/verify/${result.match ? "pass" : "mismatch"}`;
		if (!seen.has(ruleId)) {
			seen.add(ruleId);
			rules.push({
				id: ruleId,
				shortDescription: {
					text: result.match ? "Version bump matches content" : "Version bump mismatch",
				},
				defaultConfiguration: { level: toSarifLevel(result) },
			});
		}
	}

	if (report.integrity && !report.integrity.lockFound) {
		seen.add("skills-check/integrity/lockfile-missing");
		rules.push({
			id: "skills-check/integrity/lockfile-missing",
			shortDescription: { text: "skills-lock.json is missing" },
			defaultConfiguration: { level: "error" as const },
		});
	}

	for (const result of report.integrity?.results ?? []) {
		const ruleId = integrityRuleId(result.status);
		if (!seen.has(ruleId)) {
			seen.add(ruleId);
			rules.push({
				id: ruleId,
				shortDescription: { text: `Integrity status: ${result.status}` },
				defaultConfiguration: { level: integritySarifLevel(result) },
			});
		}
	}

	return rules;
}

function buildVerifyResults(results: VerifyResult[]): object[] {
	return results.filter((result) => !result.match).map((result) => ({
		ruleId: "skills-check/verify/mismatch",
		level: "error" as const,
		message: { text: result.explanation },
		locations: [
			{
				physicalLocation: {
					artifactLocation: { uri: result.file },
					region: { startLine: 1 },
				},
			},
		],
		properties: {
			skill: result.skill,
			declaredBump: result.declaredBump,
			assessedBump: result.assessedBump,
			llmUsed: result.llmUsed,
		},
	}));
}

function buildIntegrityResults(report: VerifyReport): object[] {
	if (!report.integrity) {
		return [];
	}

	if (!report.integrity.lockFound) {
		return [
			{
				ruleId: "skills-check/integrity/lockfile-missing",
				level: "error" as const,
				message: { text: "skills-lock.json not found" },
			},
		];
	}

	return report.integrity.results
		.filter((result) => result.status !== "ok")
		.map((result) => ({
			ruleId: integrityRuleId(result.status),
			level: integritySarifLevel(result),
			message: {
				text:
					result.status === "modified"
						? `${result.skill} modified (${result.field}: ${result.expected ?? "<missing>"} -> ${result.actual ?? "<missing>"})`
						: `${result.skill} ${result.status}`,
			},
			properties: {
				skill: result.skill,
				status: result.status,
				field: result.field,
				expected: result.expected,
				actual: result.actual,
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
						rules: buildRules(report),
					},
				},
				results: [...buildVerifyResults(report.results), ...buildIntegrityResults(report)],
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

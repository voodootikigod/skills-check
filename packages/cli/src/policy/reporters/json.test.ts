import { describe, expect, it } from "vitest";
import type { PolicyReport } from "../types.js";
import { formatPolicyJson } from "./json.js";

describe("formatPolicyJson", () => {
	it("produces valid JSON", () => {
		const report: PolicyReport = {
			exemptedViolations: [
				{
					file: "test.md",
					severity: "blocked",
					rule: "sources.deny",
					message: "Denied but exempted",
					skill: "internal/deploy",
					exemption: {
						skill: "internal/*",
						rule: "sources.deny",
						reason: "Approved exception",
					},
				},
			],
			exemptions: [
				{
					skill: "internal/*",
					rule: "sources.deny",
					reason: "Approved exception",
				},
			],
			policyFile: ".skill-policy.yml",
			files: 2,
			findings: [
				{
					file: "test.md",
					severity: "blocked",
					rule: "sources.deny",
					message: "Denied source",
				},
			],
			required: [{ skill: "coding-standards", satisfied: true }],
			summary: { blocked: 1, violations: 0, warnings: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatPolicyJson(report);
		const parsed = JSON.parse(output);

		expect(parsed.policyFile).toBe(".skill-policy.yml");
			expect(parsed.files).toBe(2);
			expect(parsed.findings).toHaveLength(1);
			expect(parsed.required).toHaveLength(1);
			expect(parsed.exemptions).toHaveLength(1);
			expect(parsed.exemptedViolations).toHaveLength(1);
	});

	it("pretty-prints with indentation", () => {
		const report: PolicyReport = {
			exemptedViolations: [],
			exemptions: [],
			policyFile: ".skill-policy.yml",
			files: 0,
			findings: [],
			required: [],
			summary: { blocked: 0, violations: 0, warnings: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatPolicyJson(report);
		expect(output).toContain("\n");
		expect(output).toContain("  ");
	});
});

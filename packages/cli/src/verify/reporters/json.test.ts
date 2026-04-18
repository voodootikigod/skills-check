import { describe, expect, it } from "vitest";
import type { VerifyReport } from "../types.js";
import { formatVerifyJson } from "./json.js";

describe("formatVerifyJson", () => {
	it("produces valid JSON", () => {
		const report: VerifyReport = {
			results: [
				{
					skill: "test",
					file: "test.md",
					declaredBefore: "1.0.0",
					declaredAfter: "1.1.0",
					declaredBump: "minor",
					assessedBump: "minor",
					match: true,
					signals: [
						{
							type: "minor",
							reason: "New section",
							confidence: 0.8,
							source: "heuristic",
						},
					],
					explanation: "Minor bump is correct.",
					llmUsed: false,
				},
			],
			summary: { passed: 1, failed: 0, skipped: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatVerifyJson(report);
		const parsed = JSON.parse(output);

		expect(parsed.results).toHaveLength(1);
		expect(parsed.results[0].skill).toBe("test");
		expect(parsed.integrity).toBeUndefined();
		expect(parsed.summary.passed).toBe(1);
		expect(parsed.generatedAt).toBe("2026-03-03T00:00:00.000Z");
	});

	it("includes integrity results when present", () => {
		const report: VerifyReport = {
			results: [],
			summary: { passed: 0, failed: 0, skipped: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
			integrity: {
				lockFound: true,
				results: [
					{
						skill: "react-patterns",
						status: "modified",
						field: "contentHash",
						expected: "old",
						actual: "new",
					},
				],
				summary: { ok: 0, modified: 1, missing: 0, new: 0 },
			},
		};

		const output = formatVerifyJson(report);
		const parsed = JSON.parse(output);

		expect(parsed.integrity.lockFound).toBe(true);
		expect(parsed.integrity.results[0].field).toBe("contentHash");
	});

	it("produces pretty-printed JSON with 2-space indent", () => {
		const report: VerifyReport = {
			results: [],
			summary: { passed: 0, failed: 0, skipped: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatVerifyJson(report);
		expect(output).toContain("  ");
		expect(output).toContain("\n");
	});
});

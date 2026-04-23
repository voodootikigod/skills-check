import { describe, expect, it } from "vitest";
import type { VerifyReport } from "../types.js";
import { formatVerifyMarkdown } from "./markdown.js";

describe("formatVerifyMarkdown", () => {
	it("escapes pipes and backslashes in table cells", () => {
		const report: VerifyReport = {
			results: [
				{
					skill: String.raw`demo\skill|name`,
					file: String.raw`skills\demo|skill/SKILL.md`,
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
					explanation: String.raw`Escapes \ and | correctly`,
					llmUsed: false,
				},
			],
			summary: { passed: 1, failed: 0, skipped: 0 },
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatVerifyMarkdown(report);

		expect(output).toContain(
			String.raw`| demo\\skill\|name | skills\\demo\|skill/SKILL.md | 1.0.0 → 1.1.0 (minor) | minor | No | Escapes \\ and \| correctly |`
		);
	});
});

import { describe, expect, it } from "vitest";
import type { LintReport } from "../types.js";
import { formatLintMarkdown } from "./markdown.js";

describe("formatLintMarkdown", () => {
	it("escapes pipes and backslashes in table cells", () => {
		const report: LintReport = {
			files: 1,
			findings: [
				{
					file: String.raw`skills\demo|skill/SKILL.md`,
					field: String.raw`metadata\name|title`,
					level: "warning",
					message: String.raw`Escape \ and | in markdown tables`,
					fixable: true,
				},
			],
			errors: 0,
			warnings: 1,
			infos: 0,
			fixed: 0,
			generatedAt: "2026-03-03T00:00:00.000Z",
		};

		const output = formatLintMarkdown(report);

		expect(output).toContain(
			String.raw`| skills\\demo\|skill/SKILL.md | metadata\\name\|title | Escape \\ and \| in markdown tables | Yes |`
		);
	});
});

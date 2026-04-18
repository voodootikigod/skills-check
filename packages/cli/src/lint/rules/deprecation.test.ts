import { describe, expect, it } from "vitest";
import type { SkillFile } from "../../skill-io.js";
import { checkDeprecation } from "./deprecation.js";

function makeFile(overrides: Partial<SkillFile> = {}): SkillFile {
	return {
		path: "test/SKILL.md",
		frontmatter: {},
		content: "Some content here.",
		raw: "---\n---\nSome content here.",
		...overrides,
	};
}

describe("checkDeprecation", () => {
	it("returns no findings for active skills", () => {
		expect(checkDeprecation(makeFile())).toEqual([]);
	});

	it("emits a warning for deprecated skills", () => {
		expect(
			checkDeprecation(
				makeFile({
					status: "deprecated",
					deprecatedMessage: "Use new-skill instead.",
				})
			)
		).toEqual([
			{
				file: "test/SKILL.md",
				field: "deprecated",
				level: "warning",
				message: "Skill is deprecated: Use new-skill instead.",
				fixable: false,
			},
		]);
	});
});

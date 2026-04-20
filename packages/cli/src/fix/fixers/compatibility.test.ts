import { describe, expect, it } from "vitest";
import type { SkillFile } from "../../skill-io.ts";
import { fixCompatibility } from "./compatibility.ts";

function makeSkillFile(frontmatter: Record<string, unknown>): SkillFile {
	const fmLines = Object.entries(frontmatter)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n");
	const content = "\n# Test Skill\n\nContent here.\n";
	return {
		path: "/test/SKILL.md",
		frontmatter,
		content,
		raw: `---\n${fmLines}\n---\n${content}`,
	};
}

describe("fixCompatibility", () => {
	it("returns null when no product-version", () => {
		const file = makeSkillFile({ name: "nextjs", description: "skill" });
		expect(fixCompatibility(file)).toBeNull();
	});

	it("returns null when compatibility already exists", () => {
		const file = makeSkillFile({
			name: "nextjs",
			"product-version": "15.0.0",
			compatibility: "next@^15.0.0",
		});
		expect(fixCompatibility(file)).toBeNull();
	});

	it("migrates product-version to compatibility with name", () => {
		const file = makeSkillFile({
			name: "nextjs",
			"product-version": "15.0.0",
		});
		const result = fixCompatibility(file);
		expect(result).not.toBeNull();
		expect(result?.fixes).toHaveLength(1);
		expect(result?.fixes[0].fixer).toBe("compatibility");
		expect(result?.fixes[0].description).toContain("nextjs@15.0.0");
		// The content should contain the compatibility field
		expect(result?.content).toContain("compatibility");
		// The content should not contain product-version
		expect(result?.content).not.toContain("product-version");
	});

	it("migrates product-version without name", () => {
		const file = makeSkillFile({
			"product-version": "2.0.0",
		});
		const result = fixCompatibility(file);
		expect(result).not.toBeNull();
		expect(result?.fixes[0].description).toContain("2.0.0");
	});
});

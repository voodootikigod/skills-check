import { describe, expect, it } from "vitest";
import type { SkillFile } from "../../skill-io.js";
import { checkFormats } from "./format.js";

function makeFile(frontmatter: Record<string, unknown>): SkillFile {
	return {
		path: "test/SKILL.md",
		frontmatter,
		content: "Some content here.",
		raw: "---\n---\nSome content here.",
	};
}

describe("checkFormats", () => {
	it("returns no findings for valid spec-compliant frontmatter", () => {
		const file: SkillFile = {
			path: "/skills/my-skill/SKILL.md",
			frontmatter: {
				name: "my-skill",
				description: "A test skill",
				license: "MIT",
				compatibility: "next@^15.0.0",
			},
			content: "Some content here.",
			raw: "---\n---\nSome content here.",
		};
		const findings = checkFormats(file);
		expect(findings).toEqual([]);
	});

	// --- name validation (spec-compliant) ---

	it("warns about uppercase in name", () => {
		const file = makeFile({ name: "My-Skill" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
		expect(nameFinding?.level).toBe("warning");
	});

	it("warns about underscores in name", () => {
		const file = makeFile({ name: "my_skill" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
	});

	it("warns about dots in name", () => {
		const file = makeFile({ name: "my-skill.v2" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
	});

	it("warns about scoped names (not spec-compliant)", () => {
		const file = makeFile({ name: "@org/my-skill" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
	});

	it("warns about consecutive hyphens in name", () => {
		const file = makeFile({ name: "my--skill" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
	});

	it("warns about leading hyphen in name", () => {
		const file = makeFile({ name: "-my-skill" });
		const findings = checkFormats(file);
		const nameFinding = findings.find(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFinding).toBeDefined();
	});

	it("accepts valid spec-compliant name", () => {
		const file = makeFile({ name: "my-skill" });
		const findings = checkFormats(file);
		const nameFindings = findings.filter(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFindings).toHaveLength(0);
	});

	it("accepts name with digits", () => {
		const file = makeFile({ name: "skill2" });
		const findings = checkFormats(file);
		const nameFindings = findings.filter(
			(f) => f.field === "name" && f.message.includes("does not conform")
		);
		expect(nameFindings).toHaveLength(0);
	});

	it("warns about directory name mismatch", () => {
		const file: SkillFile = {
			path: "/skills/wrong-dir/SKILL.md",
			frontmatter: { name: "my-skill" },
			content: "",
			raw: "",
		};
		const findings = checkFormats(file);
		const dirFinding = findings.find((f) => f.message.includes("does not match parent directory"));
		expect(dirFinding).toBeDefined();
	});

	// --- product-version ---

	it("reports invalid semver for product-version", () => {
		const file = makeFile({ "product-version": "not-semver" });
		const findings = checkFormats(file);
		const pvFinding = findings.find((f) => f.field === "product-version" && f.level === "error");
		expect(pvFinding).toBeDefined();
		expect(pvFinding?.message).toContain("Invalid semver");
	});

	// --- compatibility ---

	it("accepts valid compatibility with semver ranges", () => {
		const file = makeFile({ compatibility: "next@^15.0.0, react@19.0.0" });
		const findings = checkFormats(file);
		expect(findings.filter((f) => f.field === "compatibility")).toHaveLength(0);
	});

	it("accepts compatibility with non-versioned entries", () => {
		const file = makeFile({ compatibility: "docker, network" });
		const findings = checkFormats(file);
		expect(findings.filter((f) => f.field === "compatibility")).toHaveLength(0);
	});

	it("reports invalid semver range in compatibility", () => {
		const file = makeFile({ compatibility: "next@not-a-version" });
		const findings = checkFormats(file);
		const cFinding = findings.find((f) => f.field === "compatibility");
		expect(cFinding).toBeDefined();
		expect(cFinding?.level).toBe("error");
	});

	it("reports compatibility exceeding 500 chars", () => {
		const file = makeFile({ compatibility: `pkg@${"1".repeat(500)}` });
		const findings = checkFormats(file);
		const cFinding = findings.find((f) => f.field === "compatibility" && f.message.includes("500"));
		expect(cFinding).toBeDefined();
		expect(cFinding?.level).toBe("error");
	});

	it("accepts scoped packages in compatibility", () => {
		const file = makeFile({ compatibility: "@vercel/blob@^4.0.0" });
		const findings = checkFormats(file);
		expect(findings.filter((f) => f.field === "compatibility" && f.level === "error")).toHaveLength(
			0
		);
	});

	// --- repository ---

	it("reports invalid URL for repository", () => {
		const file = makeFile({ repository: "not-a-url" });
		const findings = checkFormats(file);
		const repoFinding = findings.find(
			(f) => f.field === "repository" && f.message.includes("Invalid URL")
		);
		expect(repoFinding).toBeDefined();
		expect(repoFinding?.level).toBe("error");
	});

	// --- license (downgraded to info per spec) ---

	it("reports non-SPDX license as info (spec allows any string)", () => {
		const file = makeFile({ license: "INVALID-LICENSE" });
		const findings = checkFormats(file);
		const licenseFinding = findings.find((f) => f.field === "license");
		expect(licenseFinding).toBeDefined();
		expect(licenseFinding?.level).toBe("info");
	});

	it("accepts valid SPDX license expression", () => {
		const file = makeFile({ license: "MIT OR Apache-2.0" });
		const findings = checkFormats(file);
		expect(findings.filter((f) => f.field === "license")).toHaveLength(0);
	});

	// --- metadata value types ---

	it("warns about non-string metadata values", () => {
		const file = makeFile({
			metadata: { version: "1.0", count: 42 },
		});
		const findings = checkFormats(file);
		const metaFinding = findings.find((f) => f.field === "metadata.count");
		expect(metaFinding).toBeDefined();
		expect(metaFinding?.level).toBe("info");
	});

	it("accepts all-string metadata values", () => {
		const file = makeFile({
			metadata: { version: "1.0", author: "test" },
		});
		const findings = checkFormats(file);
		const metaFindings = findings.filter((f) => f.field.startsWith("metadata."));
		expect(metaFindings).toHaveLength(0);
	});

	// --- unknown top-level fields ---

	it("warns about non-spec top-level fields", () => {
		const file = makeFile({ author: "test", version: "1.0" });
		const findings = checkFormats(file);
		const authorWarning = findings.find(
			(f) => f.field === "author" && f.message.includes("not defined in the Agent Skills spec")
		);
		const versionWarning = findings.find(
			(f) => f.field === "version" && f.message.includes("not defined in the Agent Skills spec")
		);
		expect(authorWarning).toBeDefined();
		expect(versionWarning).toBeDefined();
		expect(authorWarning?.level).toBe("info");
	});

	it("does not warn about spec-defined top-level fields", () => {
		const file = makeFile({
			name: "my-skill",
			description: "Test",
			license: "MIT",
			compatibility: "next@15.0.0",
		});
		const findings = checkFormats(file);
		const specFieldWarnings = findings.filter((f) =>
			f.message.includes("not defined in the Agent Skills spec")
		);
		expect(specFieldWarnings).toHaveLength(0);
	});

	it("skips validation for missing fields", () => {
		const file = makeFile({});
		expect(checkFormats(file)).toEqual([]);
	});

	it("skips validation for non-string typed fields", () => {
		const file = makeFile({
			"product-version": 123,
			repository: 456,
			license: true,
			name: 789,
		});
		// Non-string fields skip format checks but still get unknown-field warnings
		const findings = checkFormats(file);
		const formatErrors = findings.filter((f) => f.level === "error");
		expect(formatErrors).toHaveLength(0);
	});
});

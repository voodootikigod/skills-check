import { describe, expect, it } from "vitest";
import type { SkillFile } from "../../skill-io.js";
import { checkConditional } from "./conditional.js";

function makeFile(frontmatter: Record<string, unknown>, content: string): SkillFile {
	return {
		path: "test/SKILL.md",
		frontmatter,
		content,
		raw: `---\n---\n${content}`,
	};
}

describe("checkConditional", () => {
	it("warns about missing version tracking when product references exist", () => {
		const file = makeFile({}, "Run `npm install express` to get started.");
		const findings = checkConditional(file);
		const vFinding = findings.find((f) => f.field === "compatibility");
		expect(vFinding).toBeDefined();
		expect(vFinding?.level).toBe("warning");
		expect(vFinding?.message).toContain("compatibility");
		expect(vFinding?.message).toContain("product-version");
	});

	it("does not warn when product-version is present", () => {
		const file = makeFile(
			{ "product-version": "4.18.0" },
			"Run `npm install express` to get started."
		);
		const findings = checkConditional(file);
		const vFinding = findings.find((f) => f.field === "compatibility");
		expect(vFinding).toBeUndefined();
	});

	it("does not warn when compatibility with versioned entries is present", () => {
		const file = makeFile(
			{ compatibility: "express@4.18.0" },
			"Run `npm install express` to get started."
		);
		const findings = checkConditional(file);
		const vFinding = findings.find((f) => f.field === "compatibility");
		expect(vFinding).toBeUndefined();
	});

	it("warns when compatibility has only non-versioned entries", () => {
		const file = makeFile(
			{ compatibility: "docker, network" },
			"Run `npm install express` to get started."
		);
		const findings = checkConditional(file);
		const vFinding = findings.find((f) => f.field === "compatibility");
		expect(vFinding).toBeDefined();
	});

	it("does not warn about version tracking for generic content", () => {
		const file = makeFile({}, "This skill provides general coding best practices.");
		const findings = checkConditional(file);
		expect(findings.filter((f) => f.field === "compatibility")).toHaveLength(0);
	});

	it("emits info-level deprecation notice when product-version present without compatibility", () => {
		const file = makeFile(
			{ "product-version": "4.18.0" },
			"Run `npm install express` to get started."
		);
		const findings = checkConditional(file);
		const deprecation = findings.find((f) => f.field === "product-version" && f.level === "info");
		expect(deprecation).toBeDefined();
		expect(deprecation?.message).toContain("migrating");
		expect(deprecation?.message).toContain("compatibility");
	});

	it("does not emit deprecation notice when both compatibility and product-version present", () => {
		const file = makeFile(
			{ "product-version": "4.18.0", compatibility: "express@4.18.0" },
			"Run `npm install express` to get started."
		);
		const findings = checkConditional(file);
		const deprecation = findings.find((f) => f.field === "product-version" && f.level === "info");
		expect(deprecation).toBeUndefined();
	});

	it("warns about missing agents when agent-specific content exists", () => {
		const file = makeFile({}, "In Claude Code, use the /add command.");
		const findings = checkConditional(file);
		const agentsFinding = findings.find((f) => f.field === "agents");
		expect(agentsFinding).toBeDefined();
		expect(agentsFinding?.level).toBe("warning");
	});

	it("does not warn about agents when agents field is present", () => {
		const file = makeFile({ agents: ["claude-code"] }, "In Claude Code, use the /add command.");
		const findings = checkConditional(file);
		const agentsFinding = findings.find((f) => f.field === "agents");
		expect(agentsFinding).toBeUndefined();
	});

	it("does not warn about agents for generic content", () => {
		const file = makeFile({}, "This skill covers general patterns.");
		const findings = checkConditional(file);
		expect(findings.filter((f) => f.field === "agents")).toHaveLength(0);
	});

	it("marks all findings as not fixable", () => {
		const file = makeFile({}, "In Claude Code, run `npm install express` to get started.");
		const findings = checkConditional(file);
		for (const f of findings) {
			expect(f.fixable).toBe(false);
		}
	});
});

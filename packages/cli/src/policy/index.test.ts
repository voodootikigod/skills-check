import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { PolicyExemption } from "@skills-check/schema";
import { applyExemptions, runPolicyCheck } from "./index.js";
import type { PolicyFinding, SkillPolicy } from "./types.js";

function createViolation(overrides?: Partial<PolicyFinding>): PolicyFinding {
	return {
		file: "skills/example/SKILL.md",
		message: "Violation",
		rule: "banned",
		severity: "blocked",
		skill: "example-skill",
		...overrides,
	};
}

function createExemption(overrides?: Partial<PolicyExemption>): PolicyExemption {
	return {
		skill: "example-skill",
		rule: "banned",
		reason: "Approved exception",
		...overrides,
	};
}

describe("applyExemptions", () => {
	it("exempts a matching violation", () => {
		const result = applyExemptions([createViolation()], [createExemption()], new Date("2026-01-01"));

		expect(result.active).toEqual([]);
		expect(result.exempted).toHaveLength(1);
		expect(result.exempted[0]?.exemption.reason).toBe("Approved exception");
	});

	it("keeps non-matching violations active", () => {
		const result = applyExemptions(
			[createViolation()],
			[createExemption({ skill: "other-skill" })],
			new Date("2026-01-01")
		);

		expect(result.active).toHaveLength(1);
		expect(result.exempted).toEqual([]);
	});

	it("keeps expired exemptions active and annotates the warning", () => {
		const result = applyExemptions(
			[createViolation()],
			[createExemption({ expires: "2025-01-01" })],
			new Date("2026-01-01")
		);

		expect(result.active).toHaveLength(1);
		expect(result.active[0]?.detail).toContain("Exemption expired on 2025-01-01");
		expect(result.exempted).toEqual([]);
	});

	it("supports glob matching for skill names", () => {
		const result = applyExemptions(
			[createViolation({ skill: "internal/deploy" })],
			[createExemption({ skill: "internal/*" })],
			new Date("2026-01-01")
		);

		expect(result.active).toEqual([]);
		expect(result.exempted).toHaveLength(1);
	});

	it("uses the first matching exemption when multiple exist", () => {
		const result = applyExemptions(
			[createViolation()],
			[
				createExemption({ reason: "First reason" }),
				createExemption({ reason: "Second reason" }),
			],
			new Date("2026-01-01")
		);

		expect(result.exempted).toHaveLength(1);
		expect(result.exempted[0]?.exemption.reason).toBe("First reason");
	});
});

describe("runPolicyCheck exemptions integration", () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("filters exempted findings after validators run", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "policy-exemptions-"));
		const skillDir = join(tempDir, "example-skill");
		await mkdir(skillDir, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			`---
name: example-skill
source: third-party/skills
---

# Example Skill
`,
			"utf-8"
		);

		const policy: SkillPolicy = {
			version: 1,
			sources: {
				allow: ["our-org/*"],
			},
			exemptions: [
				{
					skill: "example-skill",
					rule: "sources.allow",
					reason: "Temporary third-party exception",
				},
			],
		};

		const report = await runPolicyCheck([tempDir], policy, join(tempDir, ".skill-policy.yml"), {
			showExemptions: true,
		});

		expect(report.findings).toEqual([]);
		expect(report.summary).toEqual({ blocked: 0, violations: 0, warnings: 0 });
		expect(report.exemptedViolations).toHaveLength(1);
		expect(report.exemptedViolations?.[0]?.rule).toBe("sources.allow");
		expect(report.showExemptions).toBe(true);
	});
});

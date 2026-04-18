import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditCommand } from "./audit.js";

describe("auditCommand integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-audit-integration-"));
		const skillDir = join(tempDir, "revoked-skill");
		await mkdir(skillDir, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			`---
name: revoked-skill
description: Test skill
---

# Revoked Skill
`,
			"utf-8"
		);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await rm(tempDir, { recursive: true, force: true });
	});

	it("fails audit when a skill is revoked", async () => {
		const revocationPath = join(tempDir, ".skill-revocations.json");
		await writeFile(
			revocationPath,
			JSON.stringify(
				{
					revocationVersion: 1,
					updatedAt: "2026-04-18T00:00:00Z",
					entries: [
						{
							skill: "revoked-skill",
							reason: "Contains prompt injection",
							revokedAt: "2026-04-17T00:00:00Z",
							severity: "critical",
						},
					],
				},
				null,
				2
			),
			"utf-8"
		);

		const code = await auditCommand(tempDir, {
			checkRevocations: revocationPath,
			format: "json",
			packagesOnly: true,
			skipUrls: true,
		});

		expect(code).toBe(1);
		const output = JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]));
		expect(output.summary.critical).toBe(1);
		expect(output.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					category: "revoked-skill",
					severity: "critical",
					message: 'Skill "revoked-skill" has been revoked',
				}),
			])
		);
	});
});

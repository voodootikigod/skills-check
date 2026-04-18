import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkRevocations,
	createRevocationAuditFindings,
	readRevocationList,
} from "./index.js";

describe("revocation", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-revocations-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("reads a valid revocation list", async () => {
		const filePath = join(tempDir, ".skill-revocations.json");
		await writeFile(
			filePath,
			JSON.stringify(
				{
					revocationVersion: 1,
					updatedAt: "2026-04-18T00:00:00Z",
					entries: [
						{
							skill: "bad-skill",
							reason: "Compromised prompt",
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

		expect(readRevocationList(filePath)).toEqual({
			revocationVersion: 1,
			updatedAt: "2026-04-18T00:00:00Z",
			entries: [
				{
					skill: "bad-skill",
					reason: "Compromised prompt",
					revokedAt: "2026-04-17T00:00:00Z",
					severity: "critical",
				},
			],
		});
	});

	it("returns null when the revocation file is missing", () => {
		expect(readRevocationList(join(tempDir, "missing.json"))).toBeNull();
	});

	it("matches revoked skills and preserves severity", () => {
		const matches = checkRevocations(
			["safe-skill", "bad-skill", "legacy-skill"],
			{
				revocationVersion: 1,
				updatedAt: "2026-04-18T00:00:00Z",
				entries: [
					{
						skill: "bad-skill",
						reason: "Compromised prompt",
						revokedAt: "2026-04-17T00:00:00Z",
						severity: "critical",
					},
					{
						skill: "legacy-skill",
						reason: "Unsafe legacy workflow",
						revokedAt: "2026-04-16T00:00:00Z",
						severity: "high",
					},
				],
			}
		);

		expect(matches).toEqual([
			{
				skill: "bad-skill",
				entry: {
					skill: "bad-skill",
					reason: "Compromised prompt",
					revokedAt: "2026-04-17T00:00:00Z",
					severity: "critical",
				},
			},
			{
				skill: "legacy-skill",
				entry: {
					skill: "legacy-skill",
					reason: "Unsafe legacy workflow",
					revokedAt: "2026-04-16T00:00:00Z",
					severity: "high",
				},
			},
		]);
	});

	it("builds audit findings for revoked fingerprint entries", () => {
		const findings = createRevocationAuditFindings(
			{
				version: 1,
				generatedAt: "2026-04-18T00:00:00Z",
				entries: [
					{
						skillId: "bad-skill",
						path: "/skills/bad-skill/SKILL.md",
						version: "1.0.0",
						frontmatterHash: "frontmatter",
						contentHash: "content",
						prefixHash: "prefix",
					},
				],
			},
			{
				revocationVersion: 1,
				updatedAt: "2026-04-18T00:00:00Z",
				entries: [
					{
						skill: "bad-skill",
						reason: "Compromised prompt",
						revokedAt: "2026-04-17T00:00:00Z",
						severity: "critical",
						advisory: "https://example.com/SK-1",
					},
				],
			}
		);

		expect(findings).toEqual([
			{
				category: "revoked-skill",
				evidence: "Compromised prompt",
				file: "/skills/bad-skill/SKILL.md",
				line: 1,
				message: 'Skill "bad-skill" has been revoked',
				note: "revoked at 2026-04-17T00:00:00Z; advisory: https://example.com/SK-1",
				severity: "critical",
			},
		]);
	});
});

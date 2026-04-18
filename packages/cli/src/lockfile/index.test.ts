import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FingerprintEntry, FingerprintRegistry, SkillsLockFile } from "@skills-check/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	diffLockFiles,
	LOCK_FILE_NAME,
	migrateLockFileV1,
	readLockFile,
	synchronizeLockFile,
	updateLockEntry,
	verifyIntegrity,
	writeLockFile,
} from "./index.js";

const TEST_NOW = new Date("2026-04-18T12:00:00.000Z");

function makeFingerprintEntry(overrides: Partial<FingerprintEntry> = {}): FingerprintEntry {
	return {
		skillId: "react-patterns",
		version: "1.2.3",
		source: "skills/react-patterns/SKILL.md",
		contentHash: "content-hash",
		frontmatterHash: "frontmatter-hash",
		prefixHash: "prefix-hash",
		watermark: "skill:react-patterns/1.2.3",
		tokenCount: 321,
		status: "active",
		...overrides,
	};
}

function makeLockFile(overrides: Partial<SkillsLockFile> = {}): SkillsLockFile {
	return {
		lockfileVersion: 2,
		generatedBy: "skills-check@1.3.0",
		generatedAt: "2026-04-17T00:00:00.000Z",
		skills: {
			"react-patterns": {
				name: "react-patterns",
				source: "skills/react-patterns/SKILL.md",
				contentHash: "content-hash",
				frontmatterHash: "frontmatter-hash",
				prefixHash: "prefix-hash",
				watermark: "skill:react-patterns/1.2.3",
				tokenCount: 321,
				resolvedAt: "2026-04-17T00:00:00.000Z",
				version: "1.2.3",
				status: "active",
			},
		},
		...overrides,
	};
}

describe("lockfile module", () => {
	let tempDir: string;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(TEST_NOW);
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-lockfile-"));
	});

	afterEach(async () => {
		vi.useRealTimers();
		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns null when lock file is missing", () => {
		expect(readLockFile(tempDir)).toBeNull();
	});

	it("writes and reads v2 lock files", () => {
		const lock = makeLockFile({
			skills: {
				zeta: {
					name: "zeta",
					source: "skills/zeta/SKILL.md",
					contentHash: "zeta-content",
					frontmatterHash: "zeta-frontmatter",
					prefixHash: "zeta-prefix",
					resolvedAt: TEST_NOW.toISOString(),
				},
				alpha: {
					name: "alpha",
					source: "skills/alpha/SKILL.md",
					contentHash: "alpha-content",
					frontmatterHash: "alpha-frontmatter",
					prefixHash: "alpha-prefix",
					resolvedAt: TEST_NOW.toISOString(),
				},
			},
		});

		writeLockFile(tempDir, lock);
		const parsed = readLockFile(tempDir);

		expect(parsed).not.toBeNull();
		expect(Object.keys(parsed?.skills ?? {})).toEqual(["alpha", "zeta"]);
		expect(parsed?.generatedAt).toBe(lock.generatedAt);
	});

	it("throws for invalid JSON", async () => {
		await import("node:fs/promises").then(({ writeFile }) =>
			writeFile(join(tempDir, LOCK_FILE_NAME), "{not-json", "utf-8")
		);

		expect(() => readLockFile(tempDir)).toThrow(/Invalid JSON/);
	});

	it("auto-migrates legacy v1 files on read", async () => {
		await import("node:fs/promises").then(({ writeFile }) =>
			writeFile(
				join(tempDir, LOCK_FILE_NAME),
				JSON.stringify(
					{
						version: 1,
						skills: {
							beads: {
								source: "steveyegge/beads",
								sourceType: "github",
								computedHash: "legacy-hash",
							},
						},
					},
					null,
					2
				),
				"utf-8"
			)
		);

		const parsed = readLockFile(tempDir);

		expect(parsed).toEqual(
			expect.objectContaining({
				lockfileVersion: 2,
				skills: {
					beads: expect.objectContaining({
						contentHash: "legacy-hash",
						frontmatterHash: "legacy-hash",
						prefixHash: "legacy-hash",
						source: "steveyegge/beads",
					}),
				},
			})
		);
	});

	it("updates a lock entry from a fingerprint entry", () => {
		const nextLock = updateLockEntry(makeLockFile({ skills: {} }), makeFingerprintEntry());

		expect(nextLock.generatedAt).toBe(TEST_NOW.toISOString());
		expect(nextLock.skills["react-patterns"]).toEqual(
			expect.objectContaining({
				name: "react-patterns",
				source: "skills/react-patterns/SKILL.md",
				contentHash: "content-hash",
				frontmatterHash: "frontmatter-hash",
				prefixHash: "prefix-hash",
				resolvedAt: TEST_NOW.toISOString(),
			})
		);
	});

	it("preserves resolvedAt when the entry is unchanged", () => {
		const nextLock = updateLockEntry(makeLockFile(), makeFingerprintEntry());

		expect(nextLock.skills["react-patterns"].resolvedAt).toBe("2026-04-17T00:00:00.000Z");
	});

	it("refreshes resolvedAt when the entry changes", () => {
		const nextLock = updateLockEntry(
			makeLockFile(),
			makeFingerprintEntry({ contentHash: "changed-content-hash" })
		);

		expect(nextLock.skills["react-patterns"].resolvedAt).toBe(TEST_NOW.toISOString());
		expect(nextLock.skills["react-patterns"].contentHash).toBe("changed-content-hash");
	});

	it("throws when required fingerprint hashes are missing", () => {
		expect(() =>
			updateLockEntry(
				makeLockFile({ skills: {} }),
				makeFingerprintEntry({ contentHash: undefined })
			)
		).toThrow(/missing one or more required hashes/);
	});

	it("synchronizes the lock file with current fingerprints", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [
				makeFingerprintEntry({ skillId: "alpha", source: "skills/alpha/SKILL.md" }),
				makeFingerprintEntry({
					skillId: "beta",
					source: "skills/beta/SKILL.md",
					contentHash: "beta-content",
					frontmatterHash: "beta-frontmatter",
					prefixHash: "beta-prefix",
					watermark: undefined,
				}),
			],
		};

		const nextLock = synchronizeLockFile(
			makeLockFile({
				skills: {
					"react-patterns": makeLockFile().skills["react-patterns"],
					alpha: {
						name: "alpha",
						source: "skills/alpha/SKILL.md",
						contentHash: "content-hash",
						frontmatterHash: "frontmatter-hash",
						prefixHash: "prefix-hash",
						resolvedAt: "2026-04-10T00:00:00.000Z",
					},
				},
			}),
			registry
		);

		expect(Object.keys(nextLock.skills)).toEqual(["alpha", "beta"]);
		expect(nextLock.generatedAt).toBe(TEST_NOW.toISOString());
		expect(nextLock.skills.alpha.resolvedAt).toBe(TEST_NOW.toISOString());
	});

	it("reports added removed changed and unchanged entries", () => {
		const prev = makeLockFile({
			skills: {
				alpha: {
					name: "alpha",
					source: "skills/alpha/SKILL.md",
					contentHash: "same-content",
					frontmatterHash: "same-frontmatter",
					prefixHash: "same-prefix",
					resolvedAt: "2026-04-10T00:00:00.000Z",
				},
				beta: {
					name: "beta",
					source: "skills/beta/SKILL.md",
					contentHash: "old-content",
					frontmatterHash: "old-frontmatter",
					prefixHash: "old-prefix",
					resolvedAt: "2026-04-10T00:00:00.000Z",
				},
				gamma: {
					name: "gamma",
					source: "skills/gamma/SKILL.md",
					contentHash: "gone-content",
					frontmatterHash: "gone-frontmatter",
					prefixHash: "gone-prefix",
					resolvedAt: "2026-04-10T00:00:00.000Z",
				},
			},
		});

		const next = makeLockFile({
			skills: {
				alpha: prev.skills.alpha,
				beta: {
					...prev.skills.beta,
					contentHash: "new-content",
				},
				delta: {
					name: "delta",
					source: "skills/delta/SKILL.md",
					contentHash: "delta-content",
					frontmatterHash: "delta-frontmatter",
					prefixHash: "delta-prefix",
					resolvedAt: TEST_NOW.toISOString(),
				},
			},
		});

		const diff = diffLockFiles(prev, next);

		expect(diff.added).toEqual(["delta"]);
		expect(diff.removed).toEqual(["gamma"]);
		expect(diff.unchanged).toEqual(["alpha"]);
		expect(diff.changed).toEqual([
			{
				name: "beta",
				field: "contentHash",
				from: "old-content",
				to: "new-content",
			},
		]);
	});

	it("reports ok status when lock hashes match current fingerprints", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [makeFingerprintEntry()],
		};

		expect(verifyIntegrity(makeLockFile(), registry)).toEqual([
			{
				skill: "react-patterns",
				status: "ok",
			},
		]);
	});

	it("reports modified status with the changed content hash field", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [makeFingerprintEntry({ contentHash: "changed-content" })],
		};

		expect(verifyIntegrity(makeLockFile(), registry)).toEqual([
			{
				skill: "react-patterns",
				status: "modified",
				field: "contentHash",
				expected: "content-hash",
				actual: "changed-content",
			},
		]);
	});

	it("reports modified status with the changed frontmatter hash field", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [makeFingerprintEntry({ frontmatterHash: "changed-frontmatter" })],
		};

		expect(verifyIntegrity(makeLockFile(), registry)).toEqual([
			{
				skill: "react-patterns",
				status: "modified",
				field: "frontmatterHash",
				expected: "frontmatter-hash",
				actual: "changed-frontmatter",
			},
		]);
	});

	it("reports modified status with the changed prefix hash field", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [makeFingerprintEntry({ prefixHash: "changed-prefix" })],
		};

		expect(verifyIntegrity(makeLockFile(), registry)).toEqual([
			{
				skill: "react-patterns",
				status: "modified",
				field: "prefixHash",
				expected: "prefix-hash",
				actual: "changed-prefix",
			},
		]);
	});

	it("reports missing status when a locked skill is absent on disk", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [],
		};

		expect(verifyIntegrity(makeLockFile(), registry)).toEqual([
			{
				skill: "react-patterns",
				status: "missing",
			},
		]);
	});

	it("reports new status when a fingerprinted skill is not in the lock file", () => {
		const registry: FingerprintRegistry = {
			version: 1,
			generatedAt: TEST_NOW.toISOString(),
			entries: [makeFingerprintEntry({ skillId: "new-skill", source: "skills/new-skill/SKILL.md" })],
		};

		expect(verifyIntegrity(makeLockFile({ skills: {} }), registry)).toEqual([
			{
				skill: "new-skill",
				status: "new",
			},
		]);
	});

	it("migrates the current legacy stub format", () => {
		const migrated = migrateLockFileV1({
			version: 1,
			skills: {
				beads: {
					source: "steveyegge/beads",
					sourceType: "github",
					computedHash: "legacy-hash",
				},
			},
		});

		expect(migrated).toEqual(
			expect.objectContaining({
				lockfileVersion: 2,
				generatedAt: TEST_NOW.toISOString(),
				skills: {
					beads: {
						name: "beads",
						source: "steveyegge/beads",
						contentHash: "legacy-hash",
						frontmatterHash: "legacy-hash",
						prefixHash: "legacy-hash",
						resolvedAt: TEST_NOW.toISOString(),
					},
				},
			})
		);
	});
});

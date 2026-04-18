import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateObject } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchChangelog } from "../changelog.js";
import { readLockFile } from "../lockfile/index.js";
import { resolveModel } from "../llm/providers.js";
import { fetchLatestVersions } from "../npm.js";
import { loadRegistry, saveRegistry } from "../registry.js";
import type { Registry } from "../types.js";
import { fingerprintCommand } from "./fingerprint.js";
import { healthCommand } from "./health.js";
import { refreshCommand } from "./refresh.js";

vi.mock("../npm.js", () => ({
	fetchLatestVersions: vi.fn(),
}));

vi.mock("../registry.js", () => ({
	loadRegistry: vi.fn(),
	saveRegistry: vi.fn(),
}));

vi.mock("../changelog.js", () => ({
	fetchChangelog: vi.fn(),
}));

vi.mock("../llm/providers.js", () => ({
	resolveModel: vi.fn(),
}));

vi.mock("ai", () => ({
	generateObject: vi.fn(),
}));

const mockedLoadRegistry = vi.mocked(loadRegistry);
const mockedSaveRegistry = vi.mocked(saveRegistry);
const mockedFetchLatestVersions = vi.mocked(fetchLatestVersions);
const mockedFetchChangelog = vi.mocked(fetchChangelog);
const mockedResolveModel = vi.mocked(resolveModel);
const mockedGenerateObject = vi.mocked(generateObject);

const SKILL_CONTENT = `---
name: nextjs-routing
product-version: "14.0.0"
source: internal/nextjs-routing
---
# Next.js Routing

Initial content.
`;

describe("lockfile command integration", () => {
	let tempDir: string;
	let skillsDir: string;

	beforeEach(async () => {
		vi.restoreAllMocks();
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-command-lockfile-"));
		skillsDir = join(tempDir, "skills");
		await mkdir(join(skillsDir, "nextjs-routing"), { recursive: true });
		await writeFile(join(skillsDir, "nextjs-routing", "SKILL.md"), SKILL_CONTENT, "utf-8");
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await rm(tempDir, { recursive: true, force: true });
	});

	it("fingerprint auto-updates the lock file", async () => {
		const code = await fingerprintCommand(skillsDir, { quiet: true });

		expect(code).toBe(0);
		const lock = readLockFile(skillsDir);
		expect(lock?.lockfileVersion).toBe(2);
		expect(lock?.skills["nextjs-routing"]).toEqual(
			expect.objectContaining({
				name: "nextjs-routing",
				source: "internal/nextjs-routing",
				version: "14.0.0",
			})
		);
	});

	it("refresh auto-updates the lock file after rewriting a skill", async () => {
		const registry: Registry = {
			version: 1,
			lastCheck: "2026-04-17T00:00:00.000Z",
			skillsDir,
			products: {
				nextjs: {
					displayName: "Next.js",
					package: "next",
					verifiedVersion: "14.0.0",
					verifiedAt: "2026-04-17T00:00:00.000Z",
					skills: ["nextjs-routing"],
				},
			},
		};

		mockedLoadRegistry.mockResolvedValue(registry);
		mockedSaveRegistry.mockResolvedValue(join(tempDir, "skills-check.json"));
		mockedFetchLatestVersions.mockResolvedValue(new Map([["next", "15.0.0"]]));
		mockedFetchChangelog.mockResolvedValue("## Next.js 15\n- Updated routing guidance");
		mockedResolveModel.mockResolvedValue({} as Awaited<ReturnType<typeof resolveModel>>);
		mockedGenerateObject.mockResolvedValue({
			object: {
				summary: "Updated for Next.js 15",
				confidence: "high",
				breakingChanges: false,
				changes: [{ section: "routing", description: "Version bump" }],
				updatedContent: `---
name: nextjs-routing
product-version: "15.0.0"
source: internal/nextjs-routing
---
# Next.js Routing

Updated content.
`,
			},
		} as Awaited<ReturnType<typeof generateObject>>);

		const code = await refreshCommand(undefined, { yes: true });

		expect(code).toBe(0);
		const skillAfter = await readFile(join(skillsDir, "nextjs-routing", "SKILL.md"), "utf-8");
		expect(skillAfter).toContain('product-version: "15.0.0"');
		const lock = readLockFile(skillsDir);
		expect(lock?.skills["nextjs-routing"]).toEqual(
			expect.objectContaining({
				version: "15.0.0",
				source: "internal/nextjs-routing",
			})
		);
	});

	it("health --frozen-lockfile fails when the lock file is missing", async () => {
		const code = await healthCommand(skillsDir, {
			frozenLockfile: true,
			skipAudit: true,
			skipBudget: true,
			skipLint: true,
			skipPolicy: true,
			quiet: true,
		});

		expect(code).toBe(1);
	});

	it("health --frozen-lockfile passes when the lock file matches", async () => {
		await fingerprintCommand(skillsDir, { quiet: true });

		const code = await healthCommand(skillsDir, {
			frozenLockfile: true,
			skipAudit: true,
			skipBudget: true,
			skipLint: true,
			skipPolicy: true,
			quiet: true,
		});

		expect(code).toBe(0);
	});

	it("health detects tampering after a skill changes", async () => {
		await fingerprintCommand(skillsDir, { quiet: true });
		await writeFile(
			join(skillsDir, "nextjs-routing", "SKILL.md"),
			SKILL_CONTENT.replace("Initial content.", "Modified content."),
			"utf-8"
		);

		const code = await healthCommand(skillsDir, {
			skipAudit: true,
			skipBudget: true,
			skipLint: true,
			skipPolicy: true,
			format: "json",
		});

		expect(code).toBe(0);
		const output = JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]));
		expect(output.results[0]).toEqual(
			expect.objectContaining({
				command: "integrity",
				exitCode: 0,
				status: "warning",
			})
		);
		expect(output.results[0].details.join(" ")).toContain("contentHash");
	});

	it("health --frozen-lockfile fails with integrity details when skills change", async () => {
		await fingerprintCommand(skillsDir, { quiet: true });
		await writeFile(
			join(skillsDir, "nextjs-routing", "SKILL.md"),
			SKILL_CONTENT.replace("Initial content.", "Modified content."),
			"utf-8"
		);

		const code = await healthCommand(skillsDir, {
			frozenLockfile: true,
			skipAudit: true,
			skipBudget: true,
			skipLint: true,
			skipPolicy: true,
			format: "json",
		});

		expect(code).toBe(1);
		const output = JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]));
		expect(output.results[0]).toEqual(
			expect.objectContaining({
				command: "integrity",
				exitCode: 1,
			})
		);
		expect(output.results[0].details.join(" ")).toContain("contentHash");
	});

	it("health --check-revocations fails when a skill is revoked", async () => {
		const revocationPath = join(tempDir, ".skill-revocations.json");
		await writeFile(
			revocationPath,
			JSON.stringify(
				{
					revocationVersion: 1,
					updatedAt: "2026-04-18T00:00:00Z",
					entries: [
						{
							skill: "nextjs-routing",
							reason: "Compromised workflow",
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

		const code = await healthCommand(skillsDir, {
			checkRevocations: revocationPath,
			skipBudget: true,
			skipLint: true,
			skipPolicy: true,
			format: "json",
		});

		expect(code).toBe(1);
		const output = JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]));
		expect(output.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					command: "audit",
					exitCode: 1,
					status: "failure",
					summary: expect.stringContaining("finding"),
					details: expect.arrayContaining([
						expect.stringContaining('Skill "nextjs-routing" has been revoked'),
					]),
				}),
				expect.objectContaining({
					command: "integrity",
					exitCode: 0,
					status: "warning",
				}),
			])
		);
	});
});

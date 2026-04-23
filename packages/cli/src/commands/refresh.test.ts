import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillFile } from "../skill-io.js";
import type { Registry } from "../types.js";

const {
	mockBuildSystemPrompt,
	mockBuildUserPrompt,
	mockCreateInterface,
	mockDiffStats,
	mockExtractVersionedPackages,
	mockFetchChangelog,
	mockFetchLatestVersions,
	mockFormatCompatibility,
	mockFormatDiff,
	mockGenerateObject,
	mockGetSeverity,
	mockLoadRegistry,
	mockNormalizeVersion,
	mockParseCompatibility,
	promptAnswers,
	promptQuestions,
	mockReadSkillFile,
	mockResolveModel,
	mockSaveRegistry,
	mockStringify,
	mockWriteSkillFile,
} = vi.hoisted(() => {
	const answers: string[] = [];
	const questions: string[] = [];
	const close = vi.fn();

	return {
		mockBuildSystemPrompt: vi.fn(),
		mockBuildUserPrompt: vi.fn(),
		mockCreateInterface: vi.fn(() => ({
			close,
			on: vi.fn(),
			question: (question: string, callback: (answer: string) => void) => {
				questions.push(question);
				callback(answers.shift() ?? "n");
			},
		})),
		mockDiffStats: vi.fn(),
		mockExtractVersionedPackages: vi.fn(),
		mockFetchChangelog: vi.fn(),
		mockFetchLatestVersions: vi.fn(),
		mockFormatCompatibility: vi.fn(),
		mockFormatDiff: vi.fn(),
		mockGenerateObject: vi.fn(),
		mockGetSeverity: vi.fn(),
		mockLoadRegistry: vi.fn(),
		mockNormalizeVersion: vi.fn(),
		mockParseCompatibility: vi.fn(),
		mockReadSkillFile: vi.fn(),
		mockResolveModel: vi.fn(),
		mockSaveRegistry: vi.fn(),
		mockStringify: vi.fn(),
		mockWriteSkillFile: vi.fn(),
		promptAnswers: answers,
		promptQuestions: questions,
	};
});

vi.mock("node:readline", () => ({
	createInterface: mockCreateInterface,
}));

vi.mock("ai", () => ({
	generateObject: mockGenerateObject,
}));

vi.mock("gray-matter", () => ({
	default: {
		stringify: mockStringify,
	},
}));

vi.mock("../changelog.js", () => ({
	fetchChangelog: mockFetchChangelog,
}));

vi.mock("../compatibility/index.js", () => ({
	extractVersionedPackages: mockExtractVersionedPackages,
	formatCompatibility: mockFormatCompatibility,
	parseCompatibility: mockParseCompatibility,
}));

vi.mock("../diff.js", () => ({
	diffStats: mockDiffStats,
	formatDiff: mockFormatDiff,
}));

vi.mock("../llm/prompts.js", () => ({
	buildSystemPrompt: mockBuildSystemPrompt,
	buildUserPrompt: mockBuildUserPrompt,
}));

vi.mock("../llm/providers.js", () => ({
	resolveModel: mockResolveModel,
}));

vi.mock("../llm/schemas.js", () => ({
	RefreshResultSchema: { name: "RefreshResultSchema" },
}));

vi.mock("../npm.js", () => ({
	fetchLatestVersions: mockFetchLatestVersions,
}));

vi.mock("../registry.js", () => ({
	loadRegistry: mockLoadRegistry,
	saveRegistry: mockSaveRegistry,
}));

vi.mock("../severity.js", () => ({
	getSeverity: mockGetSeverity,
	normalizeVersion: mockNormalizeVersion,
}));

vi.mock("../skill-io.js", () => ({
	readSkillFile: mockReadSkillFile,
	writeSkillFile: mockWriteSkillFile,
}));

import { generateObject } from "ai";
import { fetchChangelog } from "../changelog.js";
import { diffStats, formatDiff } from "../diff.js";
import { buildSystemPrompt, buildUserPrompt } from "../llm/prompts.js";
import { resolveModel } from "../llm/providers.js";
import { fetchLatestVersions } from "../npm.js";
import { loadRegistry, saveRegistry } from "../registry.js";
import { getSeverity, normalizeVersion } from "../severity.js";
import { readSkillFile, writeSkillFile } from "../skill-io.js";
import { refreshCommand } from "./refresh.js";

const mockedBuildSystemPrompt = vi.mocked(buildSystemPrompt);
const mockedBuildUserPrompt = vi.mocked(buildUserPrompt);
const mockedDiffStats = vi.mocked(diffStats);
const mockedFetchChangelog = vi.mocked(fetchChangelog);
const mockedFetchLatestVersions = vi.mocked(fetchLatestVersions);
const mockedFormatDiff = vi.mocked(formatDiff);
const mockedGenerateObject = vi.mocked(generateObject);
const mockedGetSeverity = vi.mocked(getSeverity);
const mockedLoadRegistry = vi.mocked(loadRegistry);
const mockedNormalizeVersion = vi.mocked(normalizeVersion);
const mockedReadSkillFile = vi.mocked(readSkillFile);
const mockedResolveModel = vi.mocked(resolveModel);
const mockedSaveRegistry = vi.mocked(saveRegistry);
const mockedWriteSkillFile = vi.mocked(writeSkillFile);

const FIXED_DATE = new Date("2026-04-23T12:00:00.000Z");
const FIXED_ISO = FIXED_DATE.toISOString();

function makeRegistry(overrides?: Partial<Registry>): Registry {
	return {
		$schema: "https://skillscheck.ai/schema.json",
		lastCheck: "2026-04-01T00:00:00.000Z",
		products: {
			"ai-sdk": {
				changelog: "https://example.com/changelog",
				displayName: "Vercel AI SDK",
				package: "ai",
				skills: ["ai-sdk-core"],
				verifiedAt: "2026-04-01T00:00:00.000Z",
				verifiedVersion: "1.0.0",
			},
		},
		skillsDir: "./registry-skills",
		version: 1,
		...overrides,
	};
}

function makeSkillFile(filePath: string, overrides?: Partial<SkillFile>): SkillFile {
	return {
		content: "body",
		frontmatter: {
			"product-version": "1.0.0",
		},
		path: filePath,
		raw: "---\nproduct-version: 1.0.0\n---\nbody",
		...overrides,
	};
}

describe("refreshCommand", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_DATE);
		promptAnswers.length = 0;
		promptQuestions.length = 0;
		mockedLoadRegistry.mockResolvedValue(makeRegistry());
		mockedFetchLatestVersions.mockResolvedValue(new Map([["ai", "1.0.0"]]));
		mockedNormalizeVersion.mockImplementation((raw) => ({ coerced: false, version: raw }));
		mockedGetSeverity.mockReturnValue("current");
		mockedResolveModel.mockResolvedValue("resolved-model");
		mockedBuildSystemPrompt.mockReturnValue("system prompt");
		mockedBuildUserPrompt.mockReturnValue("user prompt");
		mockedFetchChangelog.mockResolvedValue("release notes");
		mockedReadSkillFile.mockResolvedValue(makeSkillFile("./registry-skills/ai-sdk-core/SKILL.md"));
		mockedGenerateObject.mockResolvedValue({
			object: {
				breakingChanges: false,
				changes: [{ description: "Updated examples", section: "Overview" }],
				confidence: "high",
				summary: "Updated for the latest release.",
				updatedContent: "updated-content",
			},
		} as never);
		mockedDiffStats.mockReturnValue({ additions: 2, removals: 1 });
		mockedFormatDiff.mockReturnValue("@@ diff @@");
		mockedWriteSkillFile.mockResolvedValue(undefined);
		mockedSaveRegistry.mockResolvedValue("skills-check.json");
		mockStringify.mockReturnValue("---\nproduct-version: 2.0.0\n---\nbody");
		mockExtractVersionedPackages.mockReturnValue([]);
		mockParseCompatibility.mockReturnValue([]);
		mockFormatCompatibility.mockReturnValue("ai@2.0.0");
		vi.spyOn(console, "log").mockImplementation(() => {
			/* intentionally empty */
		});
		vi.spyOn(console, "error").mockImplementation(() => {
			/* intentionally empty */
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("returns 2 when the requested product is not in the registry", async () => {
		const code = await refreshCommand("./skills", { product: "missing-product" });

		expect(code).toBe(2);
		expect(mockedFetchLatestVersions).not.toHaveBeenCalled();
		expect(mockedResolveModel).not.toHaveBeenCalled();
	});

	it("returns 0 when all products are current", async () => {
		const code = await refreshCommand("./skills", {});

		expect(code).toBe(0);
		expect(mockedResolveModel).not.toHaveBeenCalled();
		expect(mockedGenerateObject).not.toHaveBeenCalled();
	});

	it("shows proposed changes in dry-run mode without writing files", async () => {
		const skillPath = "custom-skills/ai-sdk-core/SKILL.md";

		mockedFetchLatestVersions.mockResolvedValue(new Map([["ai", "1.1.0"]]));
		mockedGetSeverity.mockReturnValue("minor");
		mockedReadSkillFile.mockResolvedValue(makeSkillFile(skillPath));

		const code = await refreshCommand("./custom-skills", {
			dryRun: true,
			model: "claude-sonnet-4",
			provider: "anthropic",
		});

		expect(code).toBe(0);
		expect(mockedResolveModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4");
		expect(mockedBuildSystemPrompt).toHaveBeenCalledTimes(1);
		expect(mockedBuildUserPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				changelog: "release notes",
				displayName: "Vercel AI SDK",
				fromVersion: "1.0.0",
				skillContent: "---\nproduct-version: 1.0.0\n---\nbody",
				toVersion: "1.1.0",
			})
		);
		expect(mockedReadSkillFile).toHaveBeenCalledWith(skillPath);
		expect(mockedGenerateObject).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "resolved-model",
				prompt: "user prompt",
				system: "system prompt",
			})
		);
		expect(mockedWriteSkillFile).not.toHaveBeenCalled();
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("applies changes, patches missing version bumps, and saves the registry", async () => {
		const skillPath = "registry-skills/ai-sdk-core/SKILL.md";

		mockedFetchLatestVersions.mockResolvedValue(new Map([["ai", "2.0.0"]]));
		mockedGetSeverity.mockReturnValue("major");
		mockedFetchChangelog.mockResolvedValue(null);
		mockedReadSkillFile
			.mockResolvedValueOnce(
				makeSkillFile(skillPath, {
					raw: "---\nproduct-version: 1.0.0\n---\nold body",
				})
			)
			.mockResolvedValueOnce(
				makeSkillFile(skillPath, {
					content: "body",
					frontmatter: { "product-version": "1.0.0" },
					raw: "---\nproduct-version: 1.0.0\n---\nupdated body",
				})
			);

		const code = await refreshCommand(undefined, { yes: true });

		expect(code).toBe(0);
		expect(mockedWriteSkillFile).toHaveBeenNthCalledWith(1, skillPath, "updated-content");
		expect(mockedWriteSkillFile).toHaveBeenNthCalledWith(
			2,
			skillPath,
			"---\nproduct-version: 2.0.0\n---\nbody"
		);
		expect(mockStringify).toHaveBeenCalledWith("body", { "product-version": "2.0.0" });
		expect(mockedSaveRegistry).toHaveBeenCalledWith(
			expect.objectContaining({
				lastCheck: FIXED_ISO,
				products: {
					"ai-sdk": expect.objectContaining({
						verifiedAt: FIXED_ISO,
						verifiedVersion: "2.0.0",
					}),
				},
			}),
			undefined
		);
	});

	it("skips unreadable skill files and avoids saving the registry", async () => {
		mockedFetchLatestVersions.mockResolvedValue(new Map([["ai", "1.1.0"]]));
		mockedGetSeverity.mockReturnValue("minor");
		mockedReadSkillFile.mockRejectedValue(new Error("ENOENT"));

		const code = await refreshCommand(undefined, { yes: true });

		expect(code).toBe(0);
		expect(mockedGenerateObject).not.toHaveBeenCalled();
		expect(mockedWriteSkillFile).not.toHaveBeenCalled();
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("honors the skip-product prompt and stops processing remaining skills", async () => {
		const registry = makeRegistry({
			products: {
				"ai-sdk": {
					changelog: "https://example.com/changelog",
					displayName: "Vercel AI SDK",
					package: "ai",
					skills: ["first-skill", "second-skill"],
					verifiedAt: "2026-04-01T00:00:00.000Z",
					verifiedVersion: "1.0.0",
				},
			},
		});

		mockedLoadRegistry.mockResolvedValue(registry);
		mockedFetchLatestVersions.mockResolvedValue(new Map([["ai", "1.1.0"]]));
		mockedGetSeverity.mockReturnValue("minor");
		mockedReadSkillFile.mockResolvedValue(makeSkillFile("./registry-skills/first-skill/SKILL.md"));
		promptAnswers.push("s");

		const code = await refreshCommand(undefined, {});

		expect(code).toBe(0);
		expect(promptQuestions).toEqual([
			"\n  Apply this change? [y]es / [n]o / [a]ll / [s]kip product: ",
		]);
		expect(mockCreateInterface).toHaveBeenCalledTimes(1);
		expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
		expect(mockedWriteSkillFile).not.toHaveBeenCalled();
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("skips platform products and version lookup warnings without invoking the LLM", async () => {
		mockedLoadRegistry.mockResolvedValue(
			makeRegistry({
				products: {
					broken: {
						displayName: "Broken Package",
						package: "broken-package",
						skills: ["broken-skill"],
						verifiedAt: "2026-04-01T00:00:00.000Z",
						verifiedVersion: "1.0.0",
					},
					missing: {
						displayName: "Missing Package",
						package: "missing-package",
						skills: ["missing-skill"],
						verifiedAt: "2026-04-01T00:00:00.000Z",
						verifiedVersion: "1.0.0",
					},
					platform: {
						displayName: "Platform Product",
						package: "platform-package",
						skills: ["platform-skill"],
						verifiedAt: "2026-04-01T00:00:00.000Z",
						verifiedVersion: "platform",
					},
				},
			})
		);
		mockedFetchLatestVersions.mockResolvedValue(
			new Map<string, string | Error>([["broken-package", new Error("Registry unreachable")]])
		);

		const code = await refreshCommand(undefined, {});

		expect(code).toBe(0);
		expect(mockedResolveModel).not.toHaveBeenCalled();
		expect(mockedGenerateObject).not.toHaveBeenCalled();
		const errorOutput = vi
			.mocked(console.error)
			.mock.calls.map((call) => call[0])
			.join("\n");
		expect(errorOutput).toContain("Registry unreachable");
		expect(errorOutput).toContain('No version data for "missing-package"');
	});
});

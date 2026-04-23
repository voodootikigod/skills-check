import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScannedSkill } from "../types.js";

const {
	mockClose,
	mockCreateInterface,
	mockGroupSkills,
	mockQuestion,
	mockSaveRegistry,
	mockScanSkills,
} = vi.hoisted(() => {
	const question = vi.fn();
	const close = vi.fn();

	return {
		mockClose: close,
		mockCreateInterface: vi.fn(() => ({
			question,
			close,
		})),
		mockGroupSkills: vi.fn(),
		mockQuestion: question,
		mockSaveRegistry: vi.fn(),
		mockScanSkills: vi.fn(),
	};
});

vi.mock("node:readline/promises", () => ({
	createInterface: mockCreateInterface,
}));

vi.mock("../registry.js", () => ({
	saveRegistry: mockSaveRegistry,
}));

vi.mock("../scanner.js", () => ({
	groupSkills: mockGroupSkills,
	scanSkills: mockScanSkills,
}));

import { saveRegistry } from "../registry.js";
import { groupSkills, scanSkills } from "../scanner.js";
import { initCommand } from "./init.js";

const mockedGroupSkills = vi.mocked(groupSkills);
const mockedSaveRegistry = vi.mocked(saveRegistry);
const mockedScanSkills = vi.mocked(scanSkills);

const FIXED_DATE = new Date("2026-04-23T12:00:00.000Z");
const FIXED_ISO = FIXED_DATE.toISOString();

function makeSkill(name: string, productVersion?: string): ScannedSkill {
	return {
		name,
		path: `/skills/${name}/SKILL.md`,
		...(productVersion ? { productVersion } : {}),
	};
}

describe("initCommand", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_DATE);
		mockedScanSkills.mockResolvedValue([]);
		mockedGroupSkills.mockReturnValue(new Map());
		mockedSaveRegistry.mockResolvedValue("skills-check.json");
		mockQuestion.mockReset();
		mockQuestion.mockResolvedValue("");
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

	it("returns 2 when no skills are found", async () => {
		const code = await initCommand("./skills", { yes: true });

		expect(code).toBe(2);
		expect(mockedScanSkills).toHaveBeenCalledWith("./skills");
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("creates a registry in non-interactive mode and merges duplicate package mappings", async () => {
		const aiCore = makeSkill("ai-sdk-core", "1.0.0");
		const aiTools = makeSkill("ai-sdk-tools", "1.0.0");
		const sandboxAlpha = makeSkill("vercel-sandbox-alpha", "2.0.0");
		const sandboxBeta = makeSkill("sandbox-beta", "2.0.0");
		const docsOnly = makeSkill("docs-only");

		mockedScanSkills.mockResolvedValue([aiCore, aiTools, sandboxAlpha, sandboxBeta, docsOnly]);
		mockedGroupSkills.mockReturnValue(
			new Map([
				["ai-sdk", [aiCore, aiTools]],
				["vercel-sandbox", [sandboxAlpha]],
				["sandbox", [sandboxBeta]],
			])
		);
		mockedSaveRegistry.mockResolvedValue("/tmp/skills-check.json");

		const code = await initCommand("./skills", { output: "/tmp/skills-check.json", yes: true });

		expect(code).toBe(0);
		expect(mockedGroupSkills).toHaveBeenCalledWith([aiCore, aiTools, sandboxAlpha, sandboxBeta]);
		expect(mockedSaveRegistry).toHaveBeenCalledWith(
			expect.objectContaining({
				$schema: "https://skillscheck.ai/schema.json",
				lastCheck: FIXED_ISO,
				products: {
					"ai-sdk": {
						displayName: "Vercel AI SDK",
						package: "ai",
						verifiedAt: FIXED_ISO,
						verifiedVersion: "1.0.0",
						skills: ["ai-sdk-core", "ai-sdk-tools"],
					},
					"vercel-sandbox": {
						displayName: "Vercel Sandbox",
						package: "@vercel/sandbox",
						verifiedAt: FIXED_ISO,
						verifiedVersion: "2.0.0",
						skills: ["vercel-sandbox-alpha", "sandbox-beta"],
					},
				},
				version: 1,
			}),
			"/tmp/skills-check.json"
		);
	});

	it("returns 2 in non-interactive mode when nothing can be auto-detected", async () => {
		const unknownSkill = makeSkill("custom-tool", "3.0.0");

		mockedScanSkills.mockResolvedValue([unknownSkill]);
		mockedGroupSkills.mockReturnValue(new Map([["custom-tool", [unknownSkill]]]));

		const code = await initCommand("./skills", { yes: true });

		expect(code).toBe(2);
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("uses interactive defaults when the user accepts detected values", async () => {
		const nextSkill = makeSkill("nextjs-app-router", "15.0.0");

		mockedScanSkills.mockResolvedValue([nextSkill]);
		mockedGroupSkills.mockReturnValue(new Map([["nextjs", [nextSkill]]]));
		mockQuestion.mockResolvedValueOnce("").mockResolvedValueOnce("");

		const code = await initCommand("./skills", {});

		expect(code).toBe(0);
		expect(mockCreateInterface).toHaveBeenCalledTimes(1);
		expect(mockQuestion).toHaveBeenNthCalledWith(1, "    npm package [next]: ");
		expect(mockQuestion).toHaveBeenNthCalledWith(2, "    display name [Next.js]: ");
		expect(mockClose).toHaveBeenCalledTimes(1);
		expect(mockedSaveRegistry).toHaveBeenCalledWith(
			expect.objectContaining({
				products: {
					nextjs: {
						displayName: "Next.js",
						package: "next",
						verifiedAt: FIXED_ISO,
						verifiedVersion: "15.0.0",
						skills: ["nextjs-app-router"],
					},
				},
			}),
			undefined
		);
	});

	it("returns 2 in interactive mode when the user skips the only unmapped product", async () => {
		const customSkill = makeSkill("custom-tool", "4.0.0");

		mockedScanSkills.mockResolvedValue([customSkill]);
		mockedGroupSkills.mockReturnValue(new Map([["custom-tool", [customSkill]]]));
		mockQuestion.mockResolvedValueOnce("   ");

		const code = await initCommand("./skills", {});

		expect(code).toBe(2);
		expect(mockQuestion).toHaveBeenCalledTimes(1);
		expect(mockClose).toHaveBeenCalledTimes(1);
		expect(mockedSaveRegistry).not.toHaveBeenCalled();
	});

	it("propagates scan errors for unreadable directories", async () => {
		mockedScanSkills.mockRejectedValue(new Error("Cannot read skills directory: /missing"));

		await expect(initCommand("/missing", { yes: true })).rejects.toThrow(
			"Cannot read skills directory: /missing"
		);
	});
});

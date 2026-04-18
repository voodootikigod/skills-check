import type { SkillsLockFile } from "@skills-check/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../audit/index.js", () => ({
	runAudit: vi.fn().mockResolvedValue({
		findings: [],
		summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
		files: 1,
	}),
}));

vi.mock("../lint/index.js", () => ({
	runLint: vi.fn().mockResolvedValue({
		findings: [],
		files: 1,
	}),
}));

vi.mock("../budget/index.js", () => ({
	runBudget: vi.fn().mockResolvedValue({
		skills: [],
		totalTokens: 5000,
		cost: { model: "claude-sonnet", inputCostPer1k: 0.003, totalInputCost: 0.015 },
		redundancy: [],
		generatedAt: "2025-01-01T00:00:00.000Z",
	}),
}));

vi.mock("../fingerprint/index.js", () => ({
	runFingerprint: vi.fn().mockResolvedValue({
		version: 1,
		generatedAt: "2026-04-18T00:00:00.000Z",
		entries: [],
	}),
}));

vi.mock("../lockfile/index.js", () => ({
	readLockFile: vi.fn().mockReturnValue(null),
	verifyIntegrity: vi.fn().mockReturnValue([]),
}));

vi.mock("../policy/parser.js", () => ({
	discoverPolicyFile: vi.fn().mockResolvedValue(null),
	loadPolicyFile: vi.fn(),
}));

import { readLockFile, verifyIntegrity } from "../lockfile/index.js";
import { healthCommand } from "./health.js";

const mockedReadLockFile = vi.mocked(readLockFile);
const mockedVerifyIntegrity = vi.mocked(verifyIntegrity);

function makeLockFile(): SkillsLockFile {
	return {
		lockfileVersion: 2,
		generatedBy: "skills-check@1.0.0",
		generatedAt: "2026-04-18T00:00:00.000Z",
		skills: {},
	};
}

describe("healthCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mockedReadLockFile.mockReturnValue(null);
		mockedVerifyIntegrity.mockReturnValue([]);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("returns 0 when checks pass and integrity only warns about missing lock file", async () => {
		const code = await healthCommand(".", {});
		expect(code).toBe(0);
	});

	it("rejects --verbose and --quiet together", async () => {
		const code = await healthCommand(".", { verbose: true, quiet: true });
		expect(code).toBe(2);
	});

	it("outputs JSON format", async () => {
		const code = await healthCommand(".", { format: "json" });
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalled();
		const output = JSON.parse(logSpy.mock.calls[0][0]);
		expect(output.results).toBeDefined();
		expect(output.results.length).toBeGreaterThan(0);
		expect(output.results.some((result: { command: string }) => result.command === "integrity")).toBe(
			true
		);
	});

	it("skips commands when skip flags provided", async () => {
		const code = await healthCommand(".", {
			skipAudit: true,
			skipLint: true,
			skipBudget: true,
			skipPolicy: true,
			format: "json",
		});
		expect(code).toBe(0);
		const output = JSON.parse(logSpy.mock.calls[0][0]);
		expect(output.results).toHaveLength(1);
		expect(output.results[0].command).toBe("integrity");
	});

	it("suppresses output with --quiet", async () => {
		const code = await healthCommand(".", { quiet: true });
		expect(code).toBe(0);
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("returns 1 when budget exceeds max-tokens", async () => {
		const code = await healthCommand(".", { maxTokens: "100" });
		expect(code).toBe(1);
	});

	it("returns 1 when frozen lockfile is requested and lock file is missing", async () => {
		const code = await healthCommand(".", { frozenLockfile: true });
		expect(code).toBe(1);
	});

	it("treats modified integrity results as warnings by default", async () => {
		mockedReadLockFile.mockReturnValue(makeLockFile());
		mockedVerifyIntegrity.mockReturnValue([
			{
				skill: "react-patterns",
				status: "modified",
				field: "contentHash",
				expected: "old",
				actual: "new",
			},
		]);

		const code = await healthCommand(".", { format: "json" });
		expect(code).toBe(0);
		const output = JSON.parse(logSpy.mock.calls[0][0]);
		expect(output.results.find((result: { command: string }) => result.command === "integrity")).toMatchObject(
			{
				exitCode: 0,
				status: "warning",
			}
		);
	});

	it("treats modified integrity results as failures with frozen lockfile", async () => {
		mockedReadLockFile.mockReturnValue(makeLockFile());
		mockedVerifyIntegrity.mockReturnValue([
			{
				skill: "react-patterns",
				status: "modified",
				field: "contentHash",
				expected: "old",
				actual: "new",
			},
		]);

		const code = await healthCommand(".", { frozenLockfile: true });
		expect(code).toBe(1);
	});
});

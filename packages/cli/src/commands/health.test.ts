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

vi.mock("../policy/parser.js", () => ({
	discoverPolicyFile: vi.fn().mockResolvedValue(null),
	loadPolicyFile: vi.fn(),
}));

import { healthCommand } from "./health.js";

describe("healthCommand", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("returns 0 when all checks pass", async () => {
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
		expect(output.results).toHaveLength(0);
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
});

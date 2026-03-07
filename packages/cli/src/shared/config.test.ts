import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock os.homedir to avoid touching real user config
vi.mock("node:os", async () => {
	const actual = await vi.importActual<typeof import("node:os")>("node:os");
	return { ...actual, homedir: vi.fn(() => "/nonexistent-home-for-test") };
});

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-config-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns empty config when no config files exist", async () => {
		const config = await loadConfig(tempDir);
		expect(config).toEqual({});
	});

	it("loads project-level .skillscheckrc.yml", async () => {
		await writeFile(
			join(tempDir, ".skillscheckrc.yml"),
			"format: json\naudit:\n  failOn: medium\n",
			"utf-8"
		);

		const config = await loadConfig(tempDir);
		expect(config.format).toBe("json");
		expect(config.audit).toEqual({ failOn: "medium" });
	});

	it("walks up directories to find config", async () => {
		await writeFile(join(tempDir, ".skillscheckrc.yml"), "format: markdown\n", "utf-8");
		const subDir = join(tempDir, "sub", "deep");
		await mkdir(subDir, { recursive: true });

		const config = await loadConfig(subDir);
		expect(config.format).toBe("markdown");
	});

	it("loads all command sections", async () => {
		const yaml = `
format: sarif
audit:
  failOn: low
  skipUrls: true
  uniqueOnly: true
lint:
  failOn: warning
  fix: true
policy:
  failOn: warning
  policyPath: ./my-policy.yml
budget:
  maxTokens: 50000
  model: claude-sonnet
  detailed: true
verify:
  skipLlm: true
  provider: openai
  model: gpt-4o
test:
  agent: claude-code
  trials: 3
  timeout: 120
  provider: anthropic
  model: claude-sonnet-4-20250514
`;
		await writeFile(join(tempDir, ".skillscheckrc.yml"), yaml, "utf-8");

		const config = await loadConfig(tempDir);
		expect(config.format).toBe("sarif");
		expect(config.audit?.failOn).toBe("low");
		expect(config.audit?.skipUrls).toBe(true);
		expect(config.lint?.fix).toBe(true);
		expect(config.policy?.policyPath).toBe("./my-policy.yml");
		expect(config.budget?.maxTokens).toBe(50_000);
		expect(config.verify?.skipLlm).toBe(true);
		expect(config.test?.trials).toBe(3);
	});

	it("handles invalid YAML gracefully", async () => {
		await writeFile(join(tempDir, ".skillscheckrc.yml"), "{{{invalid yaml", "utf-8");

		const config = await loadConfig(tempDir);
		expect(config).toEqual({});
	});

	it("handles empty file gracefully", async () => {
		await writeFile(join(tempDir, ".skillscheckrc.yml"), "", "utf-8");

		const config = await loadConfig(tempDir);
		expect(config).toEqual({});
	});
});

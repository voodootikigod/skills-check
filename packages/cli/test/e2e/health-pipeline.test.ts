import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { healthCommand } from "../../src/commands/health.ts";

const FINDING_SUMMARY_RE = /\d+ finding\(s\)/;
const TOKENS_RE = /tokens/;

interface HealthJsonResult {
	results: Array<{
		command: "audit" | "budget" | "integrity" | "lint" | "policy";
		exitCode: number;
		status?: string;
		summary: string;
	}>;
}

describe("health command E2E pipeline", () => {
	let fixtureRoot: string;
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		fixtureRoot = await mkdtemp(join(tmpdir(), "skills-check-health-e2e-"));

		const validSkillDir = join(fixtureRoot, "security-review");
		const invalidSkillDir = join(fixtureRoot, "rogue-deploy");

		await Promise.all([mkdir(validSkillDir), mkdir(invalidSkillDir)]);

		await writeFile(
			join(fixtureRoot, ".skill-policy.yml"),
			[
				"version: 1",
				"required:",
				"  - skill: security-review",
				"sources:",
				"  allow:",
				"    - internal/*",
				"content:",
				"  deny_patterns:",
				"    - pattern: rm\\s+-rf\\s+/",
				'      reason: "Destructive shell commands are not allowed in skills."',
			].join("\n"),
			"utf-8"
		);

		await writeFile(
			join(validSkillDir, "SKILL.md"),
			[
				"---",
				"name: security-review",
				"description: Review changes for security risks before deployment.",
				"author: Security Team",
				"license: MIT",
				"repository: https://github.com/acme/security-review",
				"source: internal/security-review",
				"spec-version: v1",
				"keywords:",
				"  - security",
				"  - review",
				"compatibility: github@^1.0.0",
				"---",
				"# Security Review",
				"",
				"Check changes, note risky dependencies, and document mitigation steps.",
			].join("\n"),
			"utf-8"
		);

		await writeFile(
			join(invalidSkillDir, "SKILL.md"),
			[
				"---",
				"name: rogue-deploy",
				"author: Platform Team",
				"license: MIT",
				"repository: https://github.com/acme/rogue-deploy",
				"source: evil/skills",
				"spec-version: v1",
				"keywords:",
				"  - deploy",
				"compatibility: github@^1.0.0",
				"---",
				"# Rogue Deploy",
				"",
				"```bash",
				"rm -rf /",
				"```",
			].join("\n"),
			"utf-8"
		);
	});

	afterEach(() => {
		logSpy?.mockRestore();
		errorSpy?.mockRestore();
	});

	afterAll(async () => {
		await rm(fixtureRoot, { force: true, recursive: true });
	});

	it("runs audit, lint, budget, and policy against real skill fixtures", async () => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const exitCode = await healthCommand(fixtureRoot, { format: "json" });

		expect(exitCode).toBe(1);
		expect(logSpy).toHaveBeenCalledTimes(1);

		const output = JSON.parse(logSpy.mock.calls[0][0] as string) as HealthJsonResult;
		expect(output.results.map((result) => result.command)).toEqual([
			"lint",
			"audit",
			"budget",
			"integrity",
			"policy",
		]);

		const byCommand = new Map(output.results.map((result) => [result.command, result]));

		expect(byCommand.get("lint")).toMatchObject({
			exitCode: 1,
		});
		expect(byCommand.get("lint")?.summary).toMatch(FINDING_SUMMARY_RE);

		expect(byCommand.get("audit")).toMatchObject({
			exitCode: 1,
		});
		expect(byCommand.get("audit")?.summary).toMatch(FINDING_SUMMARY_RE);

		expect(byCommand.get("budget")).toMatchObject({
			exitCode: 0,
		});
		expect(byCommand.get("budget")?.summary).toMatch(TOKENS_RE);

		expect(byCommand.get("integrity")).toMatchObject({
			exitCode: 0,
			status: "warning",
		});

		expect(byCommand.get("policy")).toEqual({
			command: "policy",
			exitCode: 1,
			status: "failure",
			summary: "2 finding(s)",
		});
	});
});

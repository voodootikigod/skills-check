import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import type { SkillFile } from "../../skill-io.ts";
import { fixFrontmatter } from "./frontmatter.ts";

// biome-ignore lint/complexity/noBannedTypes: test mock callback requires loose typing
type ExecCallback = Function;

const mockedExecFile = vi.mocked(execFile);

function makeSkillFile(
	frontmatter: Record<string, unknown>,
	content = "\n# Test Skill\n\nSome content.\n"
): SkillFile {
	const fmLines = Object.entries(frontmatter)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n");
	const raw = `---\n${fmLines}\n---\n${content}`;
	return {
		path: "/test/nextjs-SKILL.md",
		frontmatter,
		content,
		raw,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	// Default: mock git commands to fail (no git context)
	mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
		const cb = typeof _opts === "function" ? _opts : callback;
		(cb as ExecCallback)(new Error("not found"), { stdout: "", stderr: "" });
		return {} as ReturnType<typeof execFile>;
	});
});

describe("fixFrontmatter", () => {
	it("returns null when all required fields present", async () => {
		const file = makeSkillFile({
			name: "nextjs",
			description: "Next.js skill",
			author: "Test Author",
		});
		const result = await fixFrontmatter(file);
		expect(result).toBeNull();
	});

	it("adds missing name from filename", async () => {
		const file = makeSkillFile({ description: "Some skill" });
		const result = await fixFrontmatter(file);
		expect(result).not.toBeNull();
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({
				fixer: "frontmatter",
				description: expect.stringContaining("name"),
			})
		);
	});

	it("adds missing description", async () => {
		const file = makeSkillFile({ name: "nextjs" });
		const result = await fixFrontmatter(file);
		expect(result).not.toBeNull();
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({ description: expect.stringContaining("description") })
		);
	});

	it("adds author from git when missing", async () => {
		mockedExecFile.mockImplementation((_cmd, args, _opts, callback) => {
			const cb = typeof _opts === "function" ? _opts : callback;
			const argsArr = args as string[];
			if (argsArr.includes("user.name")) {
				(cb as ExecCallback)(null, { stdout: "Git User\n", stderr: "" });
			} else {
				(cb as ExecCallback)(new Error("not found"), { stdout: "", stderr: "" });
			}
			return {} as ReturnType<typeof execFile>;
		});

		const file = makeSkillFile({ name: "nextjs", description: "skill" });
		const result = await fixFrontmatter(file);
		expect(result).not.toBeNull();
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({ description: expect.stringContaining("author") })
		);
	});

	it("derives name from path correctly", async () => {
		const file: SkillFile = {
			path: "/test/react-SKILL.md",
			frontmatter: { description: "React skill" },
			content: "\n# React\n",
			raw: "---\ndescription: React skill\n---\n\n# React\n",
		};
		const result = await fixFrontmatter(file);
		expect(result).not.toBeNull();
		const nameFix = result?.fixes.find((f) => f.description.includes("name"));
		expect(nameFix?.description).toContain("react");
	});
});

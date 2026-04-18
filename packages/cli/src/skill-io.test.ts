import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSkillFile, writeSkillFile } from "./skill-io.js";

describe("skill-io", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skill-io-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true });
	});

	describe("readSkillFile", () => {
		it("parses frontmatter and content", async () => {
			const content = `---
name: test-skill
product-version: "1.0.0"
---

# Test Skill

Some content here.
`;
			const filePath = join(tempDir, "SKILL.md");
			await writeFile(filePath, content, "utf-8");

			const result = await readSkillFile(filePath);

			expect(result.path).toBe(filePath);
			expect(result.frontmatter.name).toBe("test-skill");
			expect(result.frontmatter["product-version"]).toBe("1.0.0");
			expect(result.content).toContain("# Test Skill");
			expect(result.raw).toBe(content);
		});

		it("handles files without frontmatter", async () => {
			const content = "# No Frontmatter\n\nJust content.\n";
			const filePath = join(tempDir, "SKILL.md");
			await writeFile(filePath, content, "utf-8");

			const result = await readSkillFile(filePath);

			expect(result.frontmatter).toEqual({});
			expect(result.content).toContain("# No Frontmatter");
		});

		it("throws for missing file", async () => {
			await expect(readSkillFile(join(tempDir, "missing.md"))).rejects.toThrow();
		});

		it("parses deprecated lifecycle metadata", async () => {
			const content = `---
name: old-skill
deprecated: true
deprecatedMessage: Use new-skill instead.
---

# Old Skill
`;
			const filePath = join(tempDir, "SKILL.md");
			await writeFile(filePath, content, "utf-8");

			const result = await readSkillFile(filePath);

			expect(result.status).toBe("deprecated");
			expect(result.deprecatedMessage).toBe("Use new-skill instead.");
		});
	});

	describe("writeSkillFile", () => {
		it("writes content to file", async () => {
			const filePath = join(tempDir, "output.md");
			const content = "---\nname: updated\n---\n\n# Updated\n";

			await writeSkillFile(filePath, content);
			const result = await readSkillFile(filePath);

			expect(result.frontmatter.name).toBe("updated");
		});
	});
});

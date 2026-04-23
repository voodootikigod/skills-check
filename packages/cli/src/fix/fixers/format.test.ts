import { describe, expect, it } from "vitest";
import { fixFormat } from "./format.js";

const TRAILING_SPACE_RE = / +\n/;

describe("fixFormat", () => {
	it("returns null when content is already clean", () => {
		const content = "---\nname: test\n---\n\n# Skill\n\nContent.\n";
		expect(fixFormat(content)).toBeNull();
	});

	it("trims trailing whitespace", () => {
		const content = "---\nname: test  \n---\n\n# Skill   \n\nContent.\n";
		const result = fixFormat(content);
		expect(result).not.toBeNull();
		expect(result?.content).not.toMatch(TRAILING_SPACE_RE);
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({ description: "Trimmed trailing whitespace" })
		);
	});

	it("adds trailing newline when missing", () => {
		const content = "---\nname: test\n---\n\n# Skill\n\nContent.";
		const result = fixFormat(content);
		expect(result).not.toBeNull();
		expect(result?.content.endsWith("\n")).toBe(true);
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({ description: "Added trailing newline" })
		);
	});

	it("removes extra trailing newlines", () => {
		const content = "---\nname: test\n---\n\n# Skill\n\nContent.\n\n\n";
		const result = fixFormat(content);
		expect(result).not.toBeNull();
		expect(result?.content).toBe("---\nname: test\n---\n\n# Skill\n\nContent.\n");
		expect(result?.fixes).toContainEqual(
			expect.objectContaining({ description: "Removed extra trailing newlines" })
		);
	});

	it("handles both trailing whitespace and missing newline", () => {
		const content = "---\nname: test  \n---\n\nContent";
		const result = fixFormat(content);
		expect(result).not.toBeNull();
		expect(result?.fixes.length).toBeGreaterThanOrEqual(2);
	});
});

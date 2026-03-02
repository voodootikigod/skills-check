import { describe, expect, it } from "vitest";
import { diffStats, formatDiff } from "./diff.js";

describe("diff", () => {
	describe("formatDiff", () => {
		it("shows additions in green markers", () => {
			const result = formatDiff("line1\n", "line1\nnew line\n");
			expect(result).toContain("+ new line");
		});

		it("shows removals in red markers", () => {
			const result = formatDiff("old line\nkept\n", "kept\n");
			expect(result).toContain("- old line");
		});

		it("shows file path header when provided", () => {
			const result = formatDiff("a\n", "b\n", "skills/test/SKILL.md");
			expect(result).toContain("skills/test/SKILL.md");
		});

		it("returns unchanged lines with dim markers", () => {
			const result = formatDiff("same\n", "same\n");
			expect(result).toContain("same");
		});
	});

	describe("diffStats", () => {
		it("counts additions and removals", () => {
			const stats = diffStats("line1\nline2\n", "line1\nline3\nline4\n");
			expect(stats.additions).toBeGreaterThan(0);
			expect(stats.removals).toBeGreaterThan(0);
		});

		it("returns zero for identical content", () => {
			const stats = diffStats("same\n", "same\n");
			expect(stats.additions).toBe(0);
			expect(stats.removals).toBe(0);
		});
	});
});

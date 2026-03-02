import { describe, expect, it } from "vitest";
import { extractChangelogSection, parseGitHubUrl } from "./changelog.js";

describe("changelog", () => {
	describe("parseGitHubUrl", () => {
		it("parses https GitHub URL", () => {
			const result = parseGitHubUrl("https://github.com/vercel/next.js");
			expect(result).toEqual({ owner: "vercel", repo: "next.js" });
		});

		it("parses git+https URL with .git suffix", () => {
			const result = parseGitHubUrl("git+https://github.com/vercel/ai.git");
			expect(result).toEqual({ owner: "vercel", repo: "ai" });
		});

		it("parses SSH URL", () => {
			const result = parseGitHubUrl("git@github.com:vercel/next.js.git");
			expect(result).toEqual({ owner: "vercel", repo: "next.js" });
		});

		it("returns null for non-GitHub URL", () => {
			expect(parseGitHubUrl("https://gitlab.com/foo/bar")).toBeNull();
		});

		it("returns null for empty string", () => {
			expect(parseGitHubUrl("")).toBeNull();
		});
	});

	describe("extractChangelogSection", () => {
		const sampleChangelog = `# Changelog

## 3.0.0

Breaking changes here.

## 2.1.0

New features added.

## 2.0.0

Major release notes.

## 1.5.0

Old stuff.
`;

		it("extracts sections between two versions", () => {
			const result = extractChangelogSection(sampleChangelog, "2.0.0", "3.0.0");
			expect(result).toContain("Breaking changes here.");
			expect(result).toContain("## 3.0.0");
			expect(result).toContain("New features added.");
			expect(result).toContain("## 2.1.0");
			expect(result).not.toContain("Major release notes.");
		});

		it("extracts single version section", () => {
			const result = extractChangelogSection(sampleChangelog, "2.0.0", "2.1.0");
			expect(result).toContain("New features added.");
			expect(result).not.toContain("Breaking changes");
		});

		it("returns null when no matching sections found", () => {
			const result = extractChangelogSection(sampleChangelog, "4.0.0", "5.0.0");
			expect(result).toBeNull();
		});

		it("handles changelog with different heading levels", () => {
			const changelog = `### 2.0.0

Changes for v2.

### 1.0.0

Initial release.
`;
			const result = extractChangelogSection(changelog, "1.0.0", "2.0.0");
			expect(result).toContain("Changes for v2.");
		});
	});
});

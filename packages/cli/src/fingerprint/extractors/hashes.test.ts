import { beforeEach, describe, expect, it, vi } from "vitest";

const WHITESPACE_SPLIT_RE = /\s+/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

vi.mock("../../budget/tokenizer.js", () => ({
	countTokens: vi.fn((text: string) => text.split(WHITESPACE_SPLIT_RE).filter(Boolean).length),
	resetTokenizer: vi.fn(),
}));

import {
	computeContentHash,
	computeFrontmatterHash,
	computePrefixHash,
	extractRawFrontmatter,
	extractWatermark,
	generateWatermark,
	normalizeContent,
} from "./hashes.js";

describe("extractWatermark", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("extracts name, version, and source from valid watermark", () => {
		const content = "---\nname: react\n---\n<!-- skill:react/19.1.0 @acme/react -->\n# React";
		const result = extractWatermark(content);
		expect(result).toEqual({ name: "react", version: "19.1.0", source: "@acme/react" });
	});

	it("extracts watermark without source", () => {
		const content = "<!-- skill:typescript/5.7.0 -->";
		const result = extractWatermark(content);
		expect(result).toEqual({ name: "typescript", version: "5.7.0", source: undefined });
	});

	it("returns null for content without watermark", () => {
		const content = "---\nname: react\n---\n# React Skill";
		expect(extractWatermark(content)).toBeNull();
	});

	it("returns null for malformed watermark", () => {
		const content = "<!-- not a watermark -->";
		expect(extractWatermark(content)).toBeNull();
	});
});

describe("generateWatermark", () => {
	it("generates watermark with source", () => {
		expect(generateWatermark("react", "19.1.0", "@acme/react")).toBe(
			"<!-- skill:react/19.1.0 @acme/react -->"
		);
	});

	it("generates watermark without source", () => {
		expect(generateWatermark("react", "19.1.0")).toBe("<!-- skill:react/19.1.0 -->");
	});
});

describe("computeFrontmatterHash", () => {
	it("produces consistent hash for same input", () => {
		const fm = "name: react\nversion: 19.1.0";
		const hash1 = computeFrontmatterHash(fm);
		const hash2 = computeFrontmatterHash(fm);
		expect(hash1).toBe(hash2);
	});

	it("produces different hash for different input", () => {
		const hash1 = computeFrontmatterHash("name: react");
		const hash2 = computeFrontmatterHash("name: vue");
		expect(hash1).not.toBe(hash2);
	});

	it("returns a 64-char hex string for sha256", () => {
		const hash = computeFrontmatterHash("test");
		expect(hash).toMatch(SHA256_HEX_RE);
	});
});

describe("normalizeContent", () => {
	it("collapses whitespace", () => {
		expect(normalizeContent("hello   world\n\nfoo")).toBe("hello world foo");
	});

	it("strips HTML comments", () => {
		expect(normalizeContent("hello <!-- comment --> world")).toBe("hello world");
	});

	it("handles empty content", () => {
		expect(normalizeContent("")).toBe("");
	});
});

describe("computeContentHash", () => {
	it("produces same hash for whitespace-varied content", () => {
		const hash1 = computeContentHash("hello   world");
		const hash2 = computeContentHash("hello world");
		expect(hash1).toBe(hash2);
	});

	it("ignores HTML comments", () => {
		const hash1 = computeContentHash("hello world");
		const hash2 = computeContentHash("hello <!-- comment --> world");
		expect(hash1).toBe(hash2);
	});
});

describe("computePrefixHash", () => {
	it("hashes full content when under 500 tokens", () => {
		const content = "short content here";
		const prefixHash = computePrefixHash(content);
		const contentHash = computeContentHash(content);
		// Both hash the normalized full content since it's under 500 tokens
		expect(prefixHash).toBe(contentHash);
	});

	it("returns a valid hex hash", () => {
		const hash = computePrefixHash("some test content");
		expect(hash).toMatch(SHA256_HEX_RE);
	});
});

describe("extractRawFrontmatter", () => {
	it("extracts frontmatter between --- markers", () => {
		const raw = "---\nname: react\nversion: 19.1.0\n---\n# Content";
		expect(extractRawFrontmatter(raw)).toBe("name: react\nversion: 19.1.0");
	});

	it("returns null for content without frontmatter", () => {
		expect(extractRawFrontmatter("# No frontmatter")).toBeNull();
	});
});

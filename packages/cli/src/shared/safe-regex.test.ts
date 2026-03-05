import { describe, expect, it } from "vitest";
import { isSafeRegex } from "./safe-regex.js";

describe("isSafeRegex", () => {
	describe("safe patterns", () => {
		it.each([
			["simple literal", "hello"],
			["character class", "[a-z]+"],
			["alternation", "foo|bar|baz"],
			["anchored quantifier", "^\\w+$"],
			["non-greedy", ".*?foo"],
			["optional group", "(abc)?def"],
			["bounded repetition", "a{1,3}"],
			["complex but safe", "^https?://[\\w.-]+/[\\w./-]*$"],
			["email-like", "[\\w.+-]+@[\\w-]+\\.[a-z]{2,}"],
			["escaped special chars", "\\(\\)\\[\\]\\{\\}"],
			["empty pattern", ""],
		])("allows %s: %s", (_name, pattern) => {
			expect(isSafeRegex(pattern)).toBe(true);
		});
	});

	describe("dangerous patterns — nested quantifiers", () => {
		it.each([
			["classic ReDoS", "(a+)+"],
			["star of star", "(a*)*"],
			["plus of star", "(a*)+"],
			["star of plus", "(a+)*"],
			["nested with char class", "([a-z]+)+"],
			["nested with dot", "(.*)+"],
			["nested with bounded", "(a{2,})+"],
			["deeply nested", "((a+)+)+"],
			["non-capturing nested", "(?:a+)+"],
		])("rejects %s: %s", (_name, pattern) => {
			expect(isSafeRegex(pattern)).toBe(false);
		});
	});

	describe("dangerous patterns — excessive quantifier chains", () => {
		it.each([["4 chained quantifiers", "a+b+c+d+"]])("rejects %s: %s", (_name, pattern) => {
			expect(isSafeRegex(pattern)).toBe(false);
		});
	});

	describe("invalid patterns", () => {
		it("rejects invalid regex", () => {
			expect(isSafeRegex("(unclosed")).toBe(false);
			expect(isSafeRegex("[bad")).toBe(false);
		});
	});
});

import { describe, expect, it } from "vitest";
import { RefreshResultSchema } from "./schemas.js";

describe("RefreshResultSchema", () => {
	it("validates a correct response", () => {
		const input = {
			updatedContent: "---\nname: test\nproduct-version: '2.0.0'\n---\n\n# Test\n",
			summary: "Updated version from 1.0.0 to 2.0.0",
			changes: [{ section: "frontmatter", description: "Bumped product-version" }],
			confidence: "high",
			breakingChanges: false,
		};

		const result = RefreshResultSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it("rejects missing updatedContent", () => {
		const input = {
			summary: "Updated version",
			changes: [],
			confidence: "high",
			breakingChanges: false,
		};

		const result = RefreshResultSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("rejects invalid confidence level", () => {
		const input = {
			updatedContent: "content",
			summary: "summary",
			changes: [],
			confidence: "very-high",
			breakingChanges: false,
		};

		const result = RefreshResultSchema.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("validates all confidence levels", () => {
		for (const confidence of ["high", "medium", "low"]) {
			const input = {
				updatedContent: "content",
				summary: "summary",
				changes: [],
				confidence,
				breakingChanges: false,
			};

			const result = RefreshResultSchema.safeParse(input);
			expect(result.success).toBe(true);
		}
	});

	it("validates changes array structure", () => {
		const input = {
			updatedContent: "content",
			summary: "summary",
			changes: [
				{ section: "code-examples", description: "Updated API usage" },
				{ section: "frontmatter", description: "Bumped version" },
			],
			confidence: "medium",
			breakingChanges: true,
		};

		const result = RefreshResultSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.changes).toHaveLength(2);
			expect(result.data.breakingChanges).toBe(true);
		}
	});
});

import { describe, expect, it } from "vitest";
import { getProviderIds } from "./providers.js";

describe("providers", () => {
	describe("getProviderIds", () => {
		it("returns known provider IDs", () => {
			const ids = getProviderIds();
			expect(ids).toContain("anthropic");
			expect(ids).toContain("openai");
			expect(ids).toContain("google");
		});

		it("returns at least 3 providers", () => {
			const ids = getProviderIds();
			expect(ids.length).toBeGreaterThanOrEqual(3);
		});
	});
});

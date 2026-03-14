import { describe, expect, it } from "vitest";
import { extractVersionedPackages, formatCompatibility, parseCompatibility } from "./parser.js";

describe("parseCompatibility", () => {
	it("parses simple package@version", () => {
		const entries = parseCompatibility("next@15.0.0");
		expect(entries).toEqual([{ package: "next", version: "15.0.0", raw: "next@15.0.0" }]);
	});

	it("parses multiple packages", () => {
		const entries = parseCompatibility("next@^15.0.0, react@19.0.0");
		expect(entries).toHaveLength(2);
		expect(entries[0]).toEqual({ package: "next", version: "^15.0.0", raw: "next@^15.0.0" });
		expect(entries[1]).toEqual({
			package: "react",
			version: "19.0.0",
			raw: "react@19.0.0",
		});
	});

	it("parses scoped packages", () => {
		const entries = parseCompatibility("@vercel/blob@4.0.0");
		expect(entries).toEqual([
			{ package: "@vercel/blob", version: "4.0.0", raw: "@vercel/blob@4.0.0" },
		]);
	});

	it("parses semver ranges", () => {
		const entries = parseCompatibility("next@^15.0.0, react@>=18.0.0, vue@~3.4.0");
		expect(entries[0].version).toBe("^15.0.0");
		expect(entries[1].version).toBe(">=18.0.0");
		expect(entries[2].version).toBe("~3.4.0");
	});

	it("handles non-versioned tokens (environment requirements)", () => {
		const entries = parseCompatibility("docker, network, git");
		expect(entries).toHaveLength(3);
		for (const entry of entries) {
			expect(entry.version).toBeUndefined();
		}
		expect(entries[0].package).toBe("docker");
		expect(entries[1].package).toBe("network");
		expect(entries[2].package).toBe("git");
	});

	it("handles mixed versioned and non-versioned", () => {
		const entries = parseCompatibility("next@^15.0.0, docker, react@19.0.0");
		expect(entries).toHaveLength(3);
		expect(entries[0].version).toBe("^15.0.0");
		expect(entries[1].version).toBeUndefined();
		expect(entries[2].version).toBe("19.0.0");
	});

	it("returns empty array for empty string", () => {
		expect(parseCompatibility("")).toEqual([]);
	});

	it("returns empty array for whitespace-only", () => {
		expect(parseCompatibility("   ")).toEqual([]);
	});

	it("returns empty array for non-string input", () => {
		expect(parseCompatibility(null as unknown as string)).toEqual([]);
		expect(parseCompatibility(undefined as unknown as string)).toEqual([]);
		expect(parseCompatibility(123 as unknown as string)).toEqual([]);
	});

	it("trims whitespace around tokens", () => {
		const entries = parseCompatibility("  next@15.0.0 ,  react@19.0.0  ");
		expect(entries[0].package).toBe("next");
		expect(entries[1].package).toBe("react");
	});

	it("handles prerelease versions", () => {
		const entries = parseCompatibility("next@15.0.0-canary.1");
		expect(entries[0].version).toBe("15.0.0-canary.1");
	});
});

describe("extractVersionedPackages", () => {
	it("filters to only versioned entries", () => {
		const entries = parseCompatibility("next@^15.0.0, docker, react@19.0.0");
		const versioned = extractVersionedPackages(entries);
		expect(versioned).toHaveLength(2);
		expect(versioned[0].package).toBe("next");
		expect(versioned[1].package).toBe("react");
	});

	it("returns empty array when no versioned entries", () => {
		const entries = parseCompatibility("docker, network");
		expect(extractVersionedPackages(entries)).toEqual([]);
	});
});

describe("formatCompatibility", () => {
	it("round-trips versioned packages", () => {
		const entries = parseCompatibility("next@^15.0.0, react@19.0.0");
		expect(formatCompatibility(entries)).toBe("next@^15.0.0, react@19.0.0");
	});

	it("round-trips mixed entries", () => {
		const entries = parseCompatibility("next@^15.0.0, docker, react@19.0.0");
		expect(formatCompatibility(entries)).toBe("next@^15.0.0, docker, react@19.0.0");
	});

	it("handles empty array", () => {
		expect(formatCompatibility([])).toBe("");
	});
});

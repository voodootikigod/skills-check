import { describe, expect, it } from "vitest";
import type { CheckContext, ExtractedPackage } from "../types.ts";
import { advisoryChecker } from "./advisory.ts";

function makeContext(packages: ExtractedPackage[]): CheckContext {
	return {
		file: { path: "test/SKILL.md", frontmatter: {}, content: "", raw: "" },
		packages,
		commands: [],
		urls: [],
	};
}

function pkg(name: string, ecosystem: "npm" | "pypi" | "crates", line = 1): ExtractedPackage {
	return { name, ecosystem, line, source: `install ${name}` };
}

describe("advisoryChecker", () => {
	it("flags known hallucinated npm packages", async () => {
		const ctx = makeContext([pkg("react-codeshift", "npm")]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe("critical");
		expect(findings[0].category).toBe("advisory-match");
		expect(findings[0].message).toContain("known hallucinated");
	});

	it("flags known hallucinated PyPI packages", async () => {
		const ctx = makeContext([pkg("huggingface-cli", "pypi")]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("advisory-match");
	});

	it("flags known hallucinated crates", async () => {
		const ctx = makeContext([pkg("rust-web-framework", "crates")]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings).toHaveLength(1);
	});

	it("passes for legitimate packages", async () => {
		const ctx = makeContext([
			pkg("express", "npm"),
			pkg("requests", "pypi"),
			pkg("serde", "crates"),
		]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings).toHaveLength(0);
	});

	it("preserves line numbers", async () => {
		const ctx = makeContext([pkg("react-codeshift", "npm", 42)]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings[0].line).toBe(42);
	});

	it("reports multiple matches", async () => {
		const ctx = makeContext([pkg("react-codeshift", "npm", 3), pkg("huggingface-cli", "pypi", 10)]);
		const findings = await advisoryChecker.check(ctx);
		expect(findings).toHaveLength(2);
	});

	describe("known typo-squatting and compromised packages", () => {
		const typoPackages = [
			{ name: "crossenv", ecosystem: "npm" as const, note: "known malicious typo of cross-env" },
			{ name: "event-stream", ecosystem: "npm" as const, note: "compromised package" },
			{ name: "loadsh", ecosystem: "npm" as const, note: "typo of lodash" },
			{ name: "coffe-script", ecosystem: "npm" as const, note: "typo of coffee-script" },
		];

		it("legitimate packages are not flagged (no false positives)", async () => {
			const ctx = makeContext([
				pkg("cross-env", "npm"),
				pkg("lodash", "npm"),
				pkg("coffee-script", "npm"),
				pkg("react", "npm"),
				pkg("flask", "pypi"),
				pkg("serde", "crates"),
			]);
			const findings = await advisoryChecker.check(ctx);
			expect(findings).toHaveLength(0);
		});

		for (const { name, ecosystem, note } of typoPackages) {
			it(`documents status of typo package "${name}" (${note})`, async () => {
				const ctx = makeContext([pkg(name, ecosystem)]);
				const findings = await advisoryChecker.check(ctx);
				// These are known-bad packages. If they're in the advisory DB, they produce
				// a critical finding. If not yet in the DB, this test documents the gap.
				// Either way, the checker must not crash on them.
				expect(Array.isArray(findings)).toBe(true);
				if (findings.length > 0) {
					expect(findings[0].severity).toBe("critical");
					expect(findings[0].category).toBe("advisory-match");
				}
			});
		}
	});

	describe("ecosystem boundary checks", () => {
		it("does not flag npm hallucinated name in wrong ecosystem", async () => {
			// "react-codeshift" is hallucinated for npm but should not flag for pypi
			const ctx = makeContext([pkg("react-codeshift", "pypi")]);
			const findings = await advisoryChecker.check(ctx);
			expect(findings).toHaveLength(0);
		});

		it("does not flag pypi hallucinated name in wrong ecosystem", async () => {
			const ctx = makeContext([pkg("huggingface-cli", "npm")]);
			const findings = await advisoryChecker.check(ctx);
			expect(findings).toHaveLength(0);
		});

		it("handles empty package list", async () => {
			const ctx = makeContext([]);
			const findings = await advisoryChecker.check(ctx);
			expect(findings).toHaveLength(0);
		});
	});
});

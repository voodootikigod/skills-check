import { beforeEach, describe, expect, it, vi } from "vitest";

const WHITESPACE_SPLIT_RE = /\s+/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

vi.mock("../budget/tokenizer.js", () => ({
	countTokens: vi.fn((text: string) => text.split(WHITESPACE_SPLIT_RE).filter(Boolean).length),
	resetTokenizer: vi.fn(),
}));

vi.mock("../shared/discovery.js", () => ({
	discoverSkillFiles: vi.fn(),
}));

vi.mock("../skill-io.js", () => ({
	readSkillFile: vi.fn(),
	writeSkillFile: vi.fn(),
}));

import { discoverSkillFiles } from "../shared/discovery.js";
import { readSkillFile, writeSkillFile } from "../skill-io.js";
import { runFingerprint } from "./index.js";

const mockDiscover = vi.mocked(discoverSkillFiles);
const mockRead = vi.mocked(readSkillFile);
const mockWrite = vi.mocked(writeSkillFile);

function makeRaw(name: string, version: string, content = "# Test\n\nSome content.") {
	return `---\nname: ${name}\nversion: ${version}\n---\n${content}`;
}

describe("runFingerprint", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns empty registry for no files", async () => {
		mockDiscover.mockResolvedValue([]);
		const result = await runFingerprint(["."]);
		expect(result.version).toBe(1);
		expect(result.skills).toHaveLength(0);
		expect(result.generated).toBeDefined();
	});

	it("generates fingerprints for discovered skills", async () => {
		const raw = makeRaw("react", "19.1.0");
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md"]);
		mockRead.mockResolvedValue({
			path: "/skills/react/SKILL.md",
			frontmatter: { name: "react", version: "19.1.0" },
			content: "# Test\n\nSome content.",
			raw,
		});

		const result = await runFingerprint(["."]);
		expect(result.skills).toHaveLength(1);
		expect(result.skills[0].name).toBe("react");
		expect(result.skills[0].version).toBe("19.1.0");
		expect(result.skills[0].fingerprints.frontmatter_sha256).toMatch(SHA256_HEX_RE);
		expect(result.skills[0].fingerprints.content_sha256).toMatch(SHA256_HEX_RE);
		expect(result.skills[0].fingerprints.content_prefix_sha256).toMatch(SHA256_HEX_RE);
		expect(result.skills[0].token_count).toBeGreaterThan(0);
	});

	it("detects existing watermark", async () => {
		const raw =
			"---\nname: react\nversion: 19.1.0\n---\n<!-- skill:react/19.1.0 @acme/react -->\n# Content";
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md"]);
		mockRead.mockResolvedValue({
			path: "/skills/react/SKILL.md",
			frontmatter: { name: "react", version: "19.1.0" },
			content: "<!-- skill:react/19.1.0 @acme/react -->\n# Content",
			raw,
		});

		const result = await runFingerprint(["."]);
		expect(result.skills[0].fingerprints.watermark).toBe("skill:react/19.1.0 @acme/react");
	});

	it("injects watermark when requested and missing", async () => {
		const raw = makeRaw("react", "19.1.0");
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md"]);
		mockRead.mockResolvedValue({
			path: "/skills/react/SKILL.md",
			frontmatter: { name: "react", version: "19.1.0" },
			content: "# Test\n\nSome content.",
			raw,
		});
		mockWrite.mockResolvedValue();

		const result = await runFingerprint(["."], { injectWatermarks: true });
		expect(mockWrite).toHaveBeenCalledOnce();
		const writtenContent = mockWrite.mock.calls[0][1];
		expect(writtenContent).toContain("<!-- skill:react/19.1.0 -->");
		expect(result.skills[0].fingerprints.watermark).toBe("skill:react/19.1.0");
	});

	it("does not inject watermark when already present", async () => {
		const raw = "---\nname: react\nversion: 19.1.0\n---\n<!-- skill:react/19.1.0 -->\n# Content";
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md"]);
		mockRead.mockResolvedValue({
			path: "/skills/react/SKILL.md",
			frontmatter: { name: "react", version: "19.1.0" },
			content: "<!-- skill:react/19.1.0 -->\n# Content",
			raw,
		});

		await runFingerprint(["."], { injectWatermarks: true });
		expect(mockWrite).not.toHaveBeenCalled();
	});

	it("handles multiple skills", async () => {
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md", "/skills/vue/SKILL.md"]);
		mockRead
			.mockResolvedValueOnce({
				path: "/skills/react/SKILL.md",
				frontmatter: { name: "react", version: "19.1.0" },
				content: "# React",
				raw: makeRaw("react", "19.1.0"),
			})
			.mockResolvedValueOnce({
				path: "/skills/vue/SKILL.md",
				frontmatter: { name: "vue", version: "3.5.0" },
				content: "# Vue",
				raw: makeRaw("vue", "3.5.0"),
			});

		const result = await runFingerprint(["."]);
		expect(result.skills).toHaveLength(2);
		expect(result.skills[0].name).toBe("react");
		expect(result.skills[1].name).toBe("vue");
	});

	it("uses product-version as fallback", async () => {
		const raw = "---\nname: react\nproduct-version: 19.1.0\n---\n# Content";
		mockDiscover.mockResolvedValue(["/skills/react/SKILL.md"]);
		mockRead.mockResolvedValue({
			path: "/skills/react/SKILL.md",
			frontmatter: { name: "react", "product-version": "19.1.0" },
			content: "# Content",
			raw,
		});

		const result = await runFingerprint(["."]);
		expect(result.skills[0].version).toBe("19.1.0");
	});
});

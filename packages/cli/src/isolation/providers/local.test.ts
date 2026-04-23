import { execFile } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalProvider } from "./local.js";

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

describe("LocalProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
			callback?.(null, "ok", "");
			return {} as never;
		});
	});

	it("prefers structured argv when provided", async () => {
		const provider = new LocalProvider();

		await provider.execute({
			argv: ["skills-check", "test", ".", "--agent-cmd", "foo --bar baz"],
			command: 'test . --agent-cmd "foo --bar baz"',
			networkAccess: false,
			skillsDir: ".",
			timeout: 30,
		});

		expect(execFile).toHaveBeenCalledWith(
			"npx",
			["skills-check", "test", ".", "--agent-cmd", "foo --bar baz"],
			expect.any(Object),
			expect.any(Function)
		);
	});
});

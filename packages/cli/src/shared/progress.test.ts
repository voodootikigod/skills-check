import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgress } from "./progress.js";

describe("createProgress", () => {
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		stderrSpy.mockRestore();
	});

	it("returns no-op when verbose is false", () => {
		const progress = createProgress(false);
		progress.step("test");
		progress.update(1, 10);
		progress.done("done");
		expect(stderrSpy).not.toHaveBeenCalled();
	});

	it("returns no-op when verbose is undefined", () => {
		const progress = createProgress();
		progress.step("test");
		expect(stderrSpy).not.toHaveBeenCalled();
	});

	it("outputs step messages when verbose", () => {
		const progress = createProgress(true);
		progress.step("Scanning files...");
		expect(stderrSpy).toHaveBeenCalledTimes(1);
		expect(stderrSpy.mock.calls[0][0]).toContain("Scanning files...");
	});

	it("outputs update with progress percentage", () => {
		const progress = createProgress(true);
		progress.update(3, 10, "files checked");
		expect(stderrSpy).toHaveBeenCalledTimes(1);
		const output = stderrSpy.mock.calls[0][0] as string;
		expect(output).toContain("3/10");
		expect(output).toContain("30%");
		expect(output).toContain("files checked");
	});

	it("outputs done message when provided", () => {
		const progress = createProgress(true);
		progress.done("Complete");
		expect(stderrSpy).toHaveBeenCalledTimes(1);
		expect(stderrSpy.mock.calls[0][0]).toContain("Complete");
	});

	it("does not output done when no message", () => {
		const progress = createProgress(true);
		progress.done();
		expect(stderrSpy).not.toHaveBeenCalled();
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process before imports
vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	access: vi.fn(),
	readFile: vi.fn(),
}));

// Mock isolation providers
vi.mock("../isolation/providers/oci.js", () => ({
	detectOCIRuntime: vi.fn(),
}));
vi.mock("../isolation/providers/apple.js", () => ({
	AppleContainerProvider: vi.fn().mockImplementation(function (this: {
		available: () => Promise<boolean>;
	}) {
		this.available = vi.fn().mockResolvedValue(false);
	}),
}));
vi.mock("../isolation/providers/vercel.js", () => ({
	VercelSandboxProvider: vi.fn().mockImplementation(function (this: {
		available: () => Promise<boolean>;
	}) {
		this.available = vi.fn().mockResolvedValue(false);
	}),
}));

import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { detectOCIRuntime } from "../isolation/providers/oci.ts";
import {
	checkIsolationRuntimes,
	checkLLMProviders,
	checkLockfiles,
	checkNodeVersion,
	checkPnpm,
	checkRegistry,
	checkRegistryFile,
} from "./checks.ts";

// biome-ignore lint/complexity/noBannedTypes: test mock callback requires loose typing
type ExecCallback = Function;

const mockedExecFile = vi.mocked(execFile);

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe("checkNodeVersion", () => {
	it("passes when Node >= 22", () => {
		const result = checkNodeVersion();
		// We're running on Node 22+ in this project
		expect(result.status).toBe("pass");
		expect(result.category).toBe("environment");
		expect(result.message).toContain("Node.js");
	});
});

describe("checkPnpm", () => {
	it("passes when pnpm is found", async () => {
		mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
			const cb = typeof _opts === "function" ? _opts : callback;
			(cb as ExecCallback)(null, { stdout: "10.24.0\n", stderr: "" });
			return {} as ReturnType<typeof execFile>;
		});

		const result = await checkPnpm();
		expect(result.status).toBe("pass");
		expect(result.message).toContain("10.24.0");
	});

	it("warns when pnpm is not found", async () => {
		mockedExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
			const cb = typeof _opts === "function" ? _opts : callback;
			(cb as ExecCallback)(new Error("not found"), { stdout: "", stderr: "" });
			return {} as ReturnType<typeof execFile>;
		});

		const result = await checkPnpm();
		expect(result.status).toBe("warn");
		expect(result.message).toContain("not found");
	});
});

describe("checkLockfiles", () => {
	it("passes when pnpm-lock.yaml exists", async () => {
		vi.mocked(access).mockResolvedValueOnce(undefined); // pnpm-lock.yaml
		vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT")); // package-lock.json

		const results = await checkLockfiles("/test");
		expect(results).toHaveLength(1);
		expect(results[0].status).toBe("pass");
		expect(results[0].message).toContain("pnpm-lock.yaml found");
	});

	it("warns on both missing pnpm-lock.yaml and present package-lock.json", async () => {
		vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT")); // pnpm-lock.yaml
		vi.mocked(access).mockResolvedValueOnce(undefined); // package-lock.json

		const results = await checkLockfiles("/test");
		expect(results).toHaveLength(2);
		expect(results[0].status).toBe("warn");
		expect(results[0].message).toContain("not found");
		expect(results[1].status).toBe("warn");
		expect(results[1].message).toContain("unexpected");
	});
});

describe("checkRegistry", () => {
	it("passes when registry is reachable", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

		const result = await checkRegistry();
		expect(result.status).toBe("pass");
		expect(result.message).toContain("reachable");
	});

	it("warns when registry returns error status", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

		const result = await checkRegistry();
		expect(result.status).toBe("warn");
		expect(result.message).toContain("503");
	});

	it("warns when registry is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

		const result = await checkRegistry();
		expect(result.status).toBe("warn");
		expect(result.message).toContain("unreachable");
	});
});

describe("checkIsolationRuntimes", () => {
	it("reports available OCI runtime", async () => {
		vi.mocked(detectOCIRuntime).mockResolvedValue({
			name: "docker",
			cmd: "docker",
		});

		const results = await checkIsolationRuntimes();
		const ociCheck = results.find((r) => r.label === "docker");
		expect(ociCheck).toBeDefined();
		expect(ociCheck?.status).toBe("pass");
	});

	it("warns when no OCI runtime found", async () => {
		vi.mocked(detectOCIRuntime).mockResolvedValue(null);

		const results = await checkIsolationRuntimes();
		const ociCheck = results.find((r) => r.label === "OCI runtime");
		expect(ociCheck).toBeDefined();
		expect(ociCheck?.status).toBe("warn");
	});
});

describe("checkLLMProviders", () => {
	it("passes when API key is set", () => {
		vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
		vi.stubEnv("OPENAI_API_KEY", "");
		vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

		const results = checkLLMProviders();
		const anthropic = results.find((r) => r.label === "ANTHROPIC_API_KEY");
		expect(anthropic?.status).toBe("pass");
	});

	it("warns when API key is not set", () => {
		vi.stubEnv("ANTHROPIC_API_KEY", "");
		vi.stubEnv("OPENAI_API_KEY", "");
		vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

		const results = checkLLMProviders();
		for (const r of results) {
			expect(r.status).toBe("warn");
		}
	});
});

describe("checkRegistryFile", () => {
	it("passes when skills-check.json exists with products", async () => {
		vi.mocked(readFile).mockResolvedValue(
			JSON.stringify({ products: { next: {}, react: {}, vue: {} } })
		);

		const result = await checkRegistryFile("/test");
		expect(result.status).toBe("pass");
		expect(result.message).toContain("3 skills tracked");
	});

	it("warns when skills-check.json is missing", async () => {
		vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

		const result = await checkRegistryFile("/test");
		expect(result.status).toBe("warn");
		expect(result.message).toContain("not found");
	});
});

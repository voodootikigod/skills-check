import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { CheckCategory, DoctorCheck } from "./types.ts";

function getExecFileAsync() {
	return promisify(execFile);
}

function check(
	category: CheckCategory,
	label: string,
	status: "pass" | "warn" | "fail",
	message: string
): DoctorCheck {
	return { category, label, status, message };
}

/**
 * Check Node.js version is >= 22.
 */
export function checkNodeVersion(): DoctorCheck {
	const version = process.version;
	const major = Number.parseInt(version.slice(1).split(".")[0], 10);
	if (major >= 22) {
		return check("environment", "Node.js", "pass", `Node.js ${version} (required: >=22)`);
	}
	return check("environment", "Node.js", "fail", `Node.js ${version} — requires >=22`);
}

/**
 * Check if pnpm is available and get its version.
 */
export async function checkPnpm(): Promise<DoctorCheck> {
	try {
		const { stdout } = await getExecFileAsync()("pnpm", ["--version"], { timeout: 5000 });
		const ver = stdout.trim();
		return check("environment", "pnpm", "pass", `pnpm ${ver} available`);
	} catch {
		return check("environment", "pnpm", "warn", "pnpm not found");
	}
}

/**
 * Check for pnpm-lock.yaml presence and warn on package-lock.json.
 */
export async function checkLockfiles(cwd: string): Promise<DoctorCheck[]> {
	const results: DoctorCheck[] = [];

	try {
		await access(resolve(cwd, "pnpm-lock.yaml"));
		results.push(check("environment", "pnpm-lock.yaml", "pass", "pnpm-lock.yaml found"));
	} catch {
		results.push(check("environment", "pnpm-lock.yaml", "warn", "pnpm-lock.yaml not found"));
	}

	try {
		await access(resolve(cwd, "package-lock.json"));
		results.push(
			check(
				"environment",
				"package-lock.json",
				"warn",
				"package-lock.json found (unexpected — pnpm project)"
			)
		);
	} catch {
		// No package-lock.json is expected — no check emitted
	}

	return results;
}

/**
 * Check npm registry reachability.
 */
export async function checkRegistry(): Promise<DoctorCheck> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const response = await fetch("https://registry.npmjs.org/skills-check", {
			signal: controller.signal,
		});
		clearTimeout(timeout);
		if (response.ok) {
			return check("network", "npm registry", "pass", "npm registry reachable");
		}
		return check("network", "npm registry", "warn", `npm registry returned ${response.status}`);
	} catch {
		return check("network", "npm registry", "warn", "npm registry unreachable");
	}
}

/**
 * Detect available container runtimes.
 */
export async function checkIsolationRuntimes(): Promise<DoctorCheck[]> {
	const results: DoctorCheck[] = [];

	// OCI runtimes (Docker, Podman, etc.)
	try {
		const { detectOCIRuntime } = await import("../isolation/providers/oci.ts");
		const runtime = await detectOCIRuntime();
		if (runtime) {
			results.push(
				check("isolation", runtime.name, "pass", `${runtime.name} available (${runtime.cmd})`)
			);
		} else {
			results.push(check("isolation", "OCI runtime", "warn", "No OCI container runtime found"));
		}
	} catch {
		results.push(check("isolation", "OCI runtime", "warn", "Could not detect OCI runtimes"));
	}

	// Apple Containers
	try {
		const { AppleContainerProvider } = await import("../isolation/providers/apple.ts");
		const apple = new AppleContainerProvider();
		if (await apple.available()) {
			results.push(check("isolation", "Apple Containers", "pass", "Apple Containers available"));
		} else {
			results.push(
				check("isolation", "Apple Containers", "warn", "Apple Containers not available")
			);
		}
	} catch {
		results.push(check("isolation", "Apple Containers", "warn", "Apple Containers not available"));
	}

	// Vercel Sandbox
	try {
		const { VercelSandboxProvider } = await import("../isolation/providers/vercel.ts");
		const vercel = new VercelSandboxProvider();
		if (await vercel.available()) {
			results.push(check("isolation", "Vercel Sandbox", "pass", "Vercel Sandbox configured"));
		} else {
			results.push(check("isolation", "Vercel Sandbox", "warn", "Vercel Sandbox not configured"));
		}
	} catch {
		results.push(check("isolation", "Vercel Sandbox", "warn", "Vercel Sandbox not configured"));
	}

	return results;
}

/**
 * Check LLM provider API keys.
 */
export function checkLLMProviders(): DoctorCheck[] {
	const providers: Array<{ env: string; name: string }> = [
		{ name: "ANTHROPIC_API_KEY", env: "ANTHROPIC_API_KEY" },
		{ name: "OPENAI_API_KEY", env: "OPENAI_API_KEY" },
		{ name: "GOOGLE_GENERATIVE_AI_API_KEY", env: "GOOGLE_GENERATIVE_AI_API_KEY" },
	];

	return providers.map(({ name, env }) => {
		if (process.env[env]) {
			return check("llm", name, "pass", `${name} configured`);
		}
		return check("llm", name, "warn", `${name} not configured`);
	});
}

/**
 * Check if skills-check.json exists in cwd and count tracked skills.
 */
export async function checkRegistryFile(cwd: string): Promise<DoctorCheck> {
	const registryPath = resolve(cwd, "skills-check.json");
	try {
		const raw = await readFile(registryPath, "utf-8");
		const data = JSON.parse(raw);
		const skillCount = Object.keys(data.products ?? data.skills ?? {}).length;
		return check(
			"project",
			"skills-check.json",
			"pass",
			`skills-check.json found (${skillCount} skills tracked)`
		);
	} catch {
		return check("project", "skills-check.json", "warn", "skills-check.json not found");
	}
}

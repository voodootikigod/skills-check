import {
	checkIsolationRuntimes,
	checkLLMProviders,
	checkLockfiles,
	checkNodeVersion,
	checkPnpm,
	checkRegistry,
	checkRegistryFile,
} from "./checks.ts";
import type { DoctorOptions, DoctorReport } from "./types.ts";

/**
 * Run all doctor checks and return a DoctorReport.
 */
export async function runDoctor(cwd: string, _options: DoctorOptions = {}): Promise<DoctorReport> {
	const checks = [
		// Environment (sync)
		checkNodeVersion(),

		// Environment (async)
		await checkPnpm(),
		...(await checkLockfiles(cwd)),

		// Network
		await checkRegistry(),

		// Isolation
		...(await checkIsolationRuntimes()),

		// LLM Providers (sync)
		...checkLLMProviders(),

		// Project
		await checkRegistryFile(cwd),
	];

	const warnings = checks.filter((c) => c.status === "warn").length;
	const errors = checks.filter((c) => c.status === "fail").length;

	return {
		checks,
		warnings,
		errors,
		generatedAt: new Date().toISOString(),
	};
}

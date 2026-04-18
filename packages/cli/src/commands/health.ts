import chalk from "chalk";
import { runAudit } from "../audit/index.js";
import type { AuditFinding, AuditOptions, AuditSeverity } from "../audit/types.js";
import { runBudget } from "../budget/index.js";
import type { BudgetOptions } from "../budget/types.js";
import { runFingerprint } from "../fingerprint/index.js";
import { runLint } from "../lint/index.js";
import type { LintOptions } from "../lint/types.js";
import { readLockFile, verifyIntegrity, type IntegrityResult } from "../lockfile/index.js";
import { runPolicyCheck } from "../policy/index.js";
import { discoverPolicyFile, loadPolicyFile } from "../policy/parser.js";
import { createRevocationAuditFindings, readRevocationList } from "../revocation/index.js";
import { auditThreshold, lintThreshold, policyThreshold } from "../shared/index.js";

interface HealthCommandOptions {
	checkRevocations?: string;
	format?: "terminal" | "json";
	frozenLockfile?: boolean;
	maxTokens?: string;
	output?: string;
	quiet?: boolean;
	skipAudit?: boolean;
	skipBudget?: boolean;
	skipLint?: boolean;
	skipPolicy?: boolean;
	verbose?: boolean;
}

interface HealthResult {
	command: string;
	details?: string[];
	exitCode: number;
	status: "error" | "failure" | "ok" | "warning";
	summary: string;
}

function createHealthResult(
	command: string,
	status: HealthResult["status"],
	summary: string,
	details?: string[]
): HealthResult {
	return {
		command,
		status,
		summary,
		details,
		exitCode: status === "error" ? 2 : status === "failure" ? 1 : 0,
	};
}

function summarizeIntegrity(results: IntegrityResult[]): {
	missing: number;
	modified: number;
	new: number;
	ok: number;
} {
	return results.reduce(
		(summary, result) => {
			summary[result.status] += 1;
			return summary;
		},
		{ ok: 0, modified: 0, missing: 0, new: 0 }
	);
}

function formatIntegrityDetails(results: IntegrityResult[]): string[] {
	return results.flatMap((result) => {
		switch (result.status) {
			case "modified":
				return [
					`${result.skill}.${result.field}: ${result.expected ?? "<missing>"} → ${result.actual ?? "<missing>"}`,
				];
			case "missing":
				return [`missing: ${result.skill}`];
			case "new":
				return [`new: ${result.skill}`];
			default:
				return [];
		}
	});
}

function formatIntegritySummary(results: IntegrityResult[]): string {
	const counts = summarizeIntegrity(results);
	const parts: string[] = [];

	if (counts.modified > 0) {
		parts.push(`${counts.modified} modified`);
	}

	if (counts.missing > 0) {
		parts.push(`${counts.missing} missing`);
	}

	if (counts.new > 0) {
		parts.push(`${counts.new} new`);
	}

	if (parts.length === 0) {
		return `${counts.ok} skill(s) verified`;
	}

	return `${parts.join(", ")} (${results.length} checked)`;
}

function getIntegrityStatus(
	results: IntegrityResult[],
	frozenLockfile: boolean | undefined
): HealthResult["status"] {
	const counts = summarizeIntegrity(results);
	if (counts.missing > 0 || (frozenLockfile && (counts.modified > 0 || counts.new > 0))) {
		return "failure";
	}

	if (counts.modified > 0 || counts.new > 0) {
		return "warning";
	}

	return "ok";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator function
export async function healthCommand(dir: string, options: HealthCommandOptions): Promise<number> {
	if (options.verbose && options.quiet) {
		console.error(chalk.red("Cannot use --verbose and --quiet together."));
		return 2;
	}

	const results: HealthResult[] = [];

	// 1. Lint
	if (!options.skipLint) {
		if (options.verbose) {
			console.error(chalk.dim("Running lint..."));
		}
		try {
			const lintOptions: LintOptions = { failOn: "error" };
			const report = await runLint([dir], lintOptions);
			const hasErrors = report.findings.some((f) =>
				lintThreshold.meetsThreshold(f.level as "error" | "warning", "error")
			);
			results.push(
				createHealthResult(
					"lint",
					hasErrors ? "failure" : "ok",
					`${report.findings.length} finding(s)`
				)
			);
		} catch (err) {
			results.push(
				createHealthResult(
					"lint",
					"error",
					`error: ${err instanceof Error ? err.message : String(err)}`
				)
			);
		}
	}

	// 2. Audit
	if (!options.skipAudit) {
		if (options.verbose) {
			console.error(chalk.dim("Running audit..."));
		}
		try {
			const auditOptions: AuditOptions = { failOn: "high" as AuditSeverity, skipUrls: true };
			const report = await runAudit([dir], auditOptions);
			const revocationFindings = await loadHealthRevocationFindings(
				dir,
				options.checkRevocations
			);
			const findings = [...report.findings, ...revocationFindings];
			results.push(
				createHealthResult(
					"audit",
					findings.some((finding) => auditThreshold.meetsThreshold(finding.severity, "high"))
						? "failure"
						: "ok",
					`${findings.length} finding(s)`,
					revocationFindings.map((finding) => `${finding.file}: ${finding.message}`)
				)
			);
		} catch (err) {
			results.push(
				createHealthResult(
					"audit",
					"error",
					`error: ${err instanceof Error ? err.message : String(err)}`
				)
			);
		}
	}

	// 3. Budget
	if (!options.skipBudget) {
		if (options.verbose) {
			console.error(chalk.dim("Running budget..."));
		}
		try {
			const maxTokens = options.maxTokens ? Number.parseInt(options.maxTokens, 10) : undefined;
			const budgetOptions: BudgetOptions = { maxTokens };
			const report = await runBudget([dir], budgetOptions);
			const overBudget = maxTokens !== undefined && report.totalTokens > maxTokens;
			results.push(
				createHealthResult(
					"budget",
					overBudget ? "failure" : "ok",
					`${report.totalTokens.toLocaleString()} tokens`
				)
			);
		} catch (err) {
			results.push(
				createHealthResult(
					"budget",
					"error",
					`error: ${err instanceof Error ? err.message : String(err)}`
				)
			);
		}
	}

	// 4. Integrity
	if (options.verbose) {
		console.error(chalk.dim("Running integrity check..."));
	}
	try {
		const fingerprintRegistry = await runFingerprint([dir]);
		const currentLock = readLockFile(dir);

		if (!currentLock) {
			results.push(
				createHealthResult(
					"integrity",
					options.frozenLockfile ? "failure" : "warning",
					"skills-lock.json missing",
					['Run "skills-check fingerprint" to generate one.']
				)
			);
		} else {
			const integrityResults = verifyIntegrity(currentLock, fingerprintRegistry);
			results.push(
				createHealthResult(
					"integrity",
					getIntegrityStatus(integrityResults, options.frozenLockfile),
					formatIntegritySummary(integrityResults),
					formatIntegrityDetails(integrityResults)
				)
			);
		}
	} catch (err) {
		results.push(
			createHealthResult(
				"integrity",
				"error",
				`error: ${err instanceof Error ? err.message : String(err)}`
			)
		);
	}

	// 5. Policy
	if (!options.skipPolicy) {
		if (options.verbose) {
			console.error(chalk.dim("Running policy check..."));
		}
		try {
			const policyPath = await discoverPolicyFile(dir);
			if (policyPath) {
				const policy = await loadPolicyFile(policyPath);
				const report = await runPolicyCheck([dir], policy, policyPath);
				const hasFindings = report.findings.some((f) =>
					policyThreshold.meetsThreshold(f.severity, "blocked")
				);
				results.push(
					createHealthResult(
						"policy",
						hasFindings ? "failure" : "ok",
						`${report.findings.length} finding(s)`
					)
				);
			} else {
				results.push(createHealthResult("policy", "ok", "no policy file found, skipped"));
			}
		} catch (err) {
			results.push(
				createHealthResult(
					"policy",
					"error",
					`error: ${err instanceof Error ? err.message : String(err)}`
				)
			);
		}
	}

	if (options.format === "json") {
		const output = JSON.stringify({ results }, null, 2);
		if (!options.quiet) {
			console.log(output);
		}
	} else if (!options.quiet) {
		console.log(chalk.bold("\nHealth Check Results"));
		console.log("=".repeat(40));
		for (const result of results) {
			let icon: string;
			if (result.status === "ok") {
				icon = chalk.green("✓");
			} else if (result.status === "warning") {
				icon = chalk.yellow("⚠");
			} else if (result.status === "failure") {
				icon = chalk.red("✗");
			} else {
				icon = chalk.yellow("!");
			}
			console.log(`  ${icon} ${chalk.bold(result.command)}: ${result.summary}`);
			for (const detail of result.details ?? []) {
				console.log(`    ${chalk.dim(detail)}`);
			}
		}
		console.log("");
	}

	const maxExit = Math.max(0, ...results.map((result) => result.exitCode));
	return maxExit > 1 ? 2 : maxExit;
}

async function loadHealthRevocationFindings(
	dir: string,
	revocationPath?: string
): Promise<AuditFinding[]> {
	if (!revocationPath) {
		return [];
	}

	const revocations = readRevocationList(revocationPath);
	if (!revocations) {
		throw new Error(`Revocation list not found: ${revocationPath}`);
	}

	const registry = await runFingerprint([dir]);
	return createRevocationAuditFindings(registry, revocations);
}

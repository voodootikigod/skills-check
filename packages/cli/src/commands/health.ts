import chalk from "chalk";
import { runAudit } from "../audit/index.js";
import type { AuditOptions, AuditSeverity } from "../audit/types.js";
import { runBudget } from "../budget/index.js";
import type { BudgetOptions } from "../budget/types.js";
import { runLint } from "../lint/index.js";
import type { LintOptions } from "../lint/types.js";
import { runPolicyCheck } from "../policy/index.js";
import { discoverPolicyFile, loadPolicyFile } from "../policy/parser.js";
import { auditThreshold, lintThreshold, policyThreshold } from "../shared/index.js";

interface HealthCommandOptions {
	format?: "terminal" | "json";
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
	exitCode: number;
	summary: string;
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
			results.push({
				command: "lint",
				exitCode: hasErrors ? 1 : 0,
				summary: `${report.findings.length} finding(s)`,
			});
		} catch (err) {
			results.push({
				command: "lint",
				exitCode: 2,
				summary: `error: ${err instanceof Error ? err.message : String(err)}`,
			});
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
			const hasFindings = report.findings.some((f) =>
				auditThreshold.meetsThreshold(f.severity, "high" as AuditSeverity)
			);
			results.push({
				command: "audit",
				exitCode: hasFindings ? 1 : 0,
				summary: `${report.summary.total} finding(s)`,
			});
		} catch (err) {
			results.push({
				command: "audit",
				exitCode: 2,
				summary: `error: ${err instanceof Error ? err.message : String(err)}`,
			});
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
			results.push({
				command: "budget",
				exitCode: overBudget ? 1 : 0,
				summary: `${report.totalTokens.toLocaleString()} tokens`,
			});
		} catch (err) {
			results.push({
				command: "budget",
				exitCode: 2,
				summary: `error: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	// 4. Policy
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
				results.push({
					command: "policy",
					exitCode: hasFindings ? 1 : 0,
					summary: `${report.findings.length} finding(s)`,
				});
			} else {
				results.push({
					command: "policy",
					exitCode: 0,
					summary: "no policy file found, skipped",
				});
			}
		} catch (err) {
			results.push({
				command: "policy",
				exitCode: 2,
				summary: `error: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	// Output results
	if (options.format === "json") {
		const output = JSON.stringify({ results }, null, 2);
		if (!options.quiet) {
			console.log(output);
		}
	} else if (!options.quiet) {
		console.log(chalk.bold("\nHealth Check Results"));
		console.log("=".repeat(40));
		for (const r of results) {
			let icon: string;
			if (r.exitCode === 0) {
				icon = chalk.green("✓");
			} else if (r.exitCode === 1) {
				icon = chalk.red("✗");
			} else {
				icon = chalk.yellow("!");
			}
			console.log(`  ${icon} ${chalk.bold(r.command)}: ${r.summary}`);
		}
		console.log("");
	}

	// Exit code: 1 if any command failed, 2 if any errored
	const maxExit = Math.max(0, ...results.map((r) => r.exitCode));
	return maxExit > 1 ? 2 : maxExit;
}

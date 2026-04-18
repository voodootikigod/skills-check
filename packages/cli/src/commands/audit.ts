import chalk from "chalk";
import { runAudit } from "../audit/index.js";
import { formatJson } from "../audit/reporters/json.js";
import { formatMarkdown } from "../audit/reporters/markdown.js";
import { formatSarif } from "../audit/reporters/sarif.js";
import { formatTerminal } from "../audit/reporters/terminal.js";
import type { AuditFinding, AuditOptions, AuditReport, AuditSeverity } from "../audit/types.js";
import { runFingerprint } from "../fingerprint/index.js";
import type { IsolationChoice } from "../isolation/types.js";
import { createRevocationAuditFindings, readRevocationList } from "../revocation/index.js";
import { auditThreshold, formatAndOutput } from "../shared/index.js";

interface AuditCommandOptions {
	failOn?: string;
	format?: "terminal" | "json" | "markdown" | "sarif";
	ignore?: string;
	includeRegistryAudits?: boolean;
	isolation?: IsolationChoice | boolean;
	output?: string;
	packagesOnly?: boolean;
	checkRevocations?: string;
	quiet?: boolean;
	skipUrls?: boolean;
	uniqueOnly?: boolean;
	verbose?: boolean;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator function
export async function auditCommand(dir: string, options: AuditCommandOptions): Promise<number> {
	if (options.verbose && options.quiet) {
		console.error(chalk.red("Cannot use --verbose and --quiet together"));
		return 2;
	}

	const failOn = (options.failOn ?? "high") as AuditSeverity;
	if (!auditThreshold.validValues.has(failOn)) {
		console.error(
			chalk.red(
				`Invalid --fail-on value: "${options.failOn}". Use: ${[...auditThreshold.validValues].join(", ")}`
			)
		);
		return 2;
	}

	// Resolve isolation preference (--no-isolation sets it to false)
	let isolationChoice: string | undefined;
	if (options.isolation === false) {
		isolationChoice = "local";
	} else if (typeof options.isolation === "string") {
		isolationChoice = options.isolation;
	}

	// If isolation is requested and not "local", delegate to the isolation provider
	if (isolationChoice && isolationChoice !== "local") {
		const { selectProvider } = await import("../isolation/detect.js");
		const provider = await selectProvider(isolationChoice as IsolationChoice, options.verbose);

		// Warn when no isolation runtime was found and we're falling back to local
		if (provider.isFallback && !options.quiet) {
			console.error(
				chalk.yellow("Warning: No isolation runtime found. Audit will run locally (URL checks will")
			);
			console.error(
				chalk.yellow(
					"make outbound requests from this machine). Use --no-isolation to suppress this warning."
				)
			);
		}

		if (provider.name !== "local") {
			if (!options.quiet) {
				console.error(chalk.dim(`Running audit in isolated environment (${provider.name})...`));
			}

			// Rebuild the CLI command string from options
			const cmdParts = [dir];
			if (options.format) {
				cmdParts.push("--format", options.format);
			}
			if (options.output) {
				cmdParts.push("--output", options.output);
			}
			if (options.failOn) {
				cmdParts.push("--fail-on", options.failOn);
			}
			if (options.packagesOnly) {
				cmdParts.push("--packages-only");
			}
			if (options.skipUrls) {
				cmdParts.push("--skip-urls");
			}
			if (options.uniqueOnly) {
				cmdParts.push("--unique-only");
			}
			if (options.includeRegistryAudits) {
				cmdParts.push("--include-registry-audits");
			}
			if (options.ignore) {
				cmdParts.push("--ignore", options.ignore);
			}
			if (options.checkRevocations) {
				cmdParts.push("--check-revocations", options.checkRevocations);
			}
			if (options.verbose) {
				cmdParts.push("--verbose");
			}
			if (options.quiet) {
				cmdParts.push("--quiet");
			}
			cmdParts.push("--no-isolation"); // Prevent recursion inside the container

			const result = await provider.execute({
				command: `audit ${cmdParts.join(" ")}`,
				skillsDir: dir,
				timeout: 300,
				networkAccess: !options.skipUrls, // URL checks need network
				env: {},
			});

			if (result.stdout) {
				console.log(result.stdout);
			}
			if (result.stderr) {
				console.error(result.stderr);
			}
			return result.exitCode;
		}
	}

	if (options.verbose) {
		console.error(chalk.dim(`Auditing: ${dir}`));
		console.error(chalk.dim(`Threshold: ${failOn}`));
		if (options.packagesOnly) {
			console.error(chalk.dim("Mode: packages-only"));
		}
		if (options.uniqueOnly) {
			console.error(chalk.dim("Mode: unique-only (skipping injection/command checkers)"));
		}
		if (options.includeRegistryAudits) {
			console.error(chalk.dim("Including skills.sh registry audits"));
		}
		if (options.skipUrls) {
			console.error(chalk.dim("Skipping URL liveness checks"));
		}
		if (options.ignore) {
			console.error(chalk.dim(`Ignore file: ${options.ignore}`));
		}
		if (options.checkRevocations) {
			console.error(chalk.dim(`Revocation file: ${options.checkRevocations}`));
		}
	}

	const auditOptions: AuditOptions = {
		format: options.format,
		output: options.output,
		failOn,
		packagesOnly: options.packagesOnly,
		skipUrls: options.skipUrls,
		ignorePath: options.ignore,
		uniqueOnly: options.uniqueOnly,
		includeRegistryAudits: options.includeRegistryAudits,
	};

	const baseReport = await runAudit([dir], auditOptions);
	const revocationFindings = await loadRevocationFindings(dir, options.checkRevocations);
	const report = mergeAuditReport(baseReport, revocationFindings);

	if (options.verbose) {
		console.error(
			chalk.dim(`Scanned ${report.files} file(s), found ${report.summary.total} finding(s)`)
		);
	}

	// Format and write output
	await formatAndOutput(
		report,
		{ format: options.format, output: options.output, quiet: options.quiet },
		{
			terminal: formatTerminal,
			json: formatJson,
			markdown: formatMarkdown,
			sarif: formatSarif,
		}
	);

	// Determine exit code based on threshold
	const hasFailingFindings = report.findings.some((f) =>
		auditThreshold.meetsThreshold(f.severity, failOn)
	);
	return hasFailingFindings ? 1 : 0;
}

async function loadRevocationFindings(
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

function mergeAuditReport(report: AuditReport, extraFindings: AuditFinding[]): AuditReport {
	if (extraFindings.length === 0) {
		return report;
	}

	const findings = [...report.findings, ...extraFindings];

	return {
		...report,
		findings,
		summary: {
			critical: findings.filter((finding) => finding.severity === "critical").length,
			high: findings.filter((finding) => finding.severity === "high").length,
			medium: findings.filter((finding) => finding.severity === "medium").length,
			low: findings.filter((finding) => finding.severity === "low").length,
			total: findings.length,
		},
	};
}

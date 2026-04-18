import chalk from "chalk";
import { formatAndOutput } from "../shared/index.js";
import { runVerify } from "../verify/index.js";
import { formatVerifyJson } from "../verify/reporters/json.js";
import { formatVerifyMarkdown } from "../verify/reporters/markdown.js";
import { formatVerifySarif } from "../verify/reporters/sarif.js";
import { formatVerifyTerminal } from "../verify/reporters/terminal.js";
import type { VerifyOptions } from "../verify/types.js";

interface VerifyCommandOptions {
	after?: string;
	all?: boolean;
	before?: string;
	checkIntegrity?: boolean;
	format?: "terminal" | "json" | "markdown" | "sarif";
	model?: string;
	output?: string;
	provider?: string;
	quiet?: boolean;
	skill?: string;
	skipLlm?: boolean;
	suggest?: boolean;
	verbose?: boolean;
}

export async function verifyCommand(options: VerifyCommandOptions): Promise<number> {
	if (options.verbose && options.quiet) {
		console.error(chalk.red("Cannot use --verbose and --quiet together"));
		return 2;
	}

	if (options.before && !options.after) {
		console.error(chalk.red("--before requires --after"));
		return 2;
	}

	if (options.after && !options.before) {
		console.error(chalk.red("--after requires --before"));
		return 2;
	}

	if (!(options.before || options.after || options.skill || options.all)) {
		console.error(chalk.red("Specify --skill <path>, --all, or --before/--after for comparison"));
		return 2;
	}

	if (options.verbose) {
		if (options.before && options.after) {
			console.error(chalk.dim(`Comparing: ${options.before} -> ${options.after}`));
		} else if (options.skill) {
			console.error(chalk.dim(`Verifying: ${options.skill}`));
		} else {
			console.error(chalk.dim("Verifying all skills..."));
		}
		if (options.skipLlm) {
			console.error(chalk.dim("LLM analysis disabled"));
		}
	}

	const verifyOptions: VerifyOptions = {
		skill: options.skill,
		all: options.all,
		before: options.before,
		checkIntegrity: options.checkIntegrity,
		after: options.after,
		suggest: options.suggest,
		format: options.format,
		output: options.output,
		provider: options.provider,
		model: options.model,
		skipLlm: options.skipLlm,
	};

	const report = await runVerify(verifyOptions);

	if (options.verbose) {
		console.error(
			chalk.dim(
				`Verified ${report.results.length} skill(s): ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`
			)
		);
	}

	// Format and write output
	await formatAndOutput(
		report,
		{ format: options.format, output: options.output, quiet: options.quiet },
		{
			terminal: formatVerifyTerminal,
			json: formatVerifyJson,
			markdown: formatVerifyMarkdown,
			sarif: formatVerifySarif,
		}
	);

	const hasIntegrityIssues =
		options.checkIntegrity &&
		(!report.integrity?.lockFound ||
			(report.integrity.summary.modified ?? 0) > 0 ||
			(report.integrity.summary.missing ?? 0) > 0 ||
			(report.integrity.summary.new ?? 0) > 0);

	// Exit code: 1 if any mismatches or integrity issues found
	return report.summary.failed > 0 || hasIntegrityIssues ? 1 : 0;
}

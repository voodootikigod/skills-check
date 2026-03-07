import chalk from "chalk";
import { runLint } from "../lint/index.js";
import { formatLintJson } from "../lint/reporters/json.js";
import { formatLintMarkdown } from "../lint/reporters/markdown.js";
import { formatLintSarif } from "../lint/reporters/sarif.js";
import { formatLintTerminal } from "../lint/reporters/terminal.js";
import type { LintOptions } from "../lint/types.js";
import { formatAndOutput, lintThreshold } from "../shared/index.js";

interface LintCommandOptions {
	ci?: boolean;
	failOn?: string;
	fix?: boolean;
	format?: "terminal" | "json" | "markdown" | "sarif";
	output?: string;
	quiet?: boolean;
	verbose?: boolean;
}

export async function lintCommand(dir: string, options: LintCommandOptions): Promise<number> {
	if (options.verbose && options.quiet) {
		console.error(chalk.red("Cannot use --verbose and --quiet together."));
		return 2;
	}

	const failOn = options.failOn ?? "error";
	if (!lintThreshold.validValues.has(failOn as "error" | "warning")) {
		console.error(
			chalk.red(
				`Invalid --fail-on value: "${options.failOn}". Use: ${[...lintThreshold.validValues].join(", ")}`
			)
		);
		return 2;
	}

	const lintOptions: LintOptions = {
		fix: options.fix,
		ci: options.ci,
		failOn: failOn as "error" | "warning",
		format: options.format,
		output: options.output,
	};

	const report = await runLint([dir], lintOptions);

	// Format and write output
	await formatAndOutput(
		report,
		{ format: options.format, output: options.output, quiet: options.quiet },
		{
			terminal: formatLintTerminal,
			json: formatLintJson,
			markdown: formatLintMarkdown,
			sarif: formatLintSarif,
		}
	);

	// Determine exit code based on threshold
	const hasFailingFindings = report.findings.some((f) =>
		lintThreshold.meetsThreshold(f.level as "error" | "warning", failOn as "error" | "warning")
	);
	return hasFailingFindings ? 1 : 0;
}

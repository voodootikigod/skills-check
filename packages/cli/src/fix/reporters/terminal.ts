import chalk from "chalk";
import type { FixReport } from "../types.ts";

export function formatFixTerminal(report: FixReport): string {
	const lines: string[] = [];

	lines.push("");
	lines.push(chalk.bold("skills-check fix"));
	lines.push("=".repeat(50));
	lines.push("");

	if (report.results.length === 0) {
		lines.push(chalk.green("No fixes needed. All skill files look good."));
		lines.push("");
		lines.push(`  ${report.files} file(s) scanned`);
		lines.push("");
		return lines.join("\n");
	}

	for (const result of report.results) {
		lines.push(chalk.bold.underline(result.file));
		lines.push("");
		for (const fix of result.applied) {
			lines.push(`  ${chalk.green("\u2713")} ${chalk.cyan(`[${fix.fixer}]`)} ${fix.description}`);
		}
		lines.push("");
	}

	lines.push(chalk.bold("Summary"));
	lines.push("=".repeat(50));
	lines.push(
		`  ${report.totalFixes} fix${report.totalFixes === 1 ? "" : "es"} ${report.written ? "applied" : "available (use --write to apply)"}`
	);
	lines.push(`  ${report.files} file(s) scanned`);
	lines.push("");

	return lines.join("\n");
}

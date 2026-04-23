import chalk from "chalk";
import type { CheckCategory, DoctorCheck, DoctorReport } from "../types.js";

const CATEGORY_LABELS: Record<CheckCategory, string> = {
	environment: "Environment",
	network: "Network",
	isolation: "Isolation",
	llm: "LLM Providers",
	project: "Project",
};

const CATEGORY_ORDER: CheckCategory[] = ["environment", "network", "isolation", "llm", "project"];

function statusIcon(status: DoctorCheck["status"]): string {
	switch (status) {
		case "pass":
			return chalk.green("\u2713");
		case "warn":
			return chalk.yellow("\u2717");
		case "fail":
			return chalk.red("\u2717");
		default:
			return " ";
	}
}

function groupByCategory(checks: DoctorCheck[]): Map<CheckCategory, DoctorCheck[]> {
	const groups = new Map<CheckCategory, DoctorCheck[]>();
	for (const c of checks) {
		const existing = groups.get(c.category) ?? [];
		existing.push(c);
		groups.set(c.category, existing);
	}
	return groups;
}

export function formatDoctorTerminal(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push("");
	lines.push(chalk.bold("skills-check doctor"));
	lines.push("");

	const grouped = groupByCategory(report.checks);

	for (const category of CATEGORY_ORDER) {
		const checks = grouped.get(category);
		if (!checks || checks.length === 0) {
			continue;
		}

		lines.push(`  ${chalk.bold(CATEGORY_LABELS[category])}`);
		for (const c of checks) {
			lines.push(`  ${statusIcon(c.status)} ${c.message}`);
		}
		lines.push("");
	}

	const parts: string[] = [];
	if (report.warnings > 0) {
		parts.push(chalk.yellow(`${report.warnings} warning${report.warnings === 1 ? "" : "s"}`));
	}
	if (report.errors > 0) {
		parts.push(chalk.red(`${report.errors} error${report.errors === 1 ? "" : "s"}`));
	}
	if (parts.length === 0) {
		lines.push(chalk.green("  All checks passed"));
	} else {
		lines.push(`  ${parts.join(", ")}`);
	}
	lines.push("");

	return lines.join("\n");
}

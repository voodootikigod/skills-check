import type { LintFinding, LintReport } from "../types.js";

function groupByLevel(findings: LintFinding[]): Map<LintFinding["level"], LintFinding[]> {
	const groups = new Map<LintFinding["level"], LintFinding[]>();
	for (const finding of findings) {
		const existing = groups.get(finding.level) ?? [];
		existing.push(finding);
		groups.set(finding.level, existing);
	}
	return groups;
}

function escapeCell(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

export function formatLintMarkdown(report: LintReport): string {
	const lines: string[] = [];
	const now = report.generatedAt.split("T")[0];

	lines.push("# Skills Check Lint Report");
	lines.push("");
	lines.push(`Generated: ${now}`);
	lines.push("");

	lines.push("## Summary");
	lines.push("");
	lines.push("| Level | Count |");
	lines.push("|-------|-------|");
	lines.push(`| Error | ${report.errors} |`);
	lines.push(`| Warning | ${report.warnings} |`);
	lines.push(`| Info | ${report.infos} |`);
	if (report.fixed > 0) {
		lines.push(`| Fixed | ${report.fixed} |`);
	}
	lines.push(`| **Total** | **${report.errors + report.warnings + report.infos}** |`);
	lines.push("");
	lines.push(`Files scanned: ${report.files}`);
	lines.push("");

	if (report.findings.length === 0) {
		lines.push("No findings. All skill files have valid metadata.");
		lines.push("");
		return lines.join("\n");
	}

	const levelOrder: LintFinding["level"][] = ["error", "warning", "info"];
	const grouped = groupByLevel(report.findings);

	for (const level of levelOrder) {
		const findings = grouped.get(level);
		if (!findings || findings.length === 0) {
			continue;
		}

		lines.push(`## ${level.charAt(0).toUpperCase() + level.slice(1)} (${findings.length})`);
		lines.push("");
		lines.push("| File | Field | Message | Fixable |");
		lines.push("|------|-------|---------|---------|");

		for (const finding of [...findings].sort((a, b) => {
			const fileComparison = a.file.localeCompare(b.file);
			if (fileComparison !== 0) {
				return fileComparison;
			}
			return a.field.localeCompare(b.field);
		})) {
			lines.push(
				`| ${escapeCell(finding.file)} | ${escapeCell(finding.field)} | ${escapeCell(finding.message)} | ${finding.fixable ? "Yes" : "No"} |`
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

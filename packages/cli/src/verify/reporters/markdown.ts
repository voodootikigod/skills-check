import type { VerifyReport, VerifyResult } from "../types.js";

type VerifyStatus = "failed" | "passed" | "skipped";

function getStatus(result: VerifyResult): VerifyStatus {
	if (result.declaredBump === null) {
		return "skipped";
	}
	return result.match ? "passed" : "failed";
}

function groupByStatus(results: VerifyResult[]): Map<VerifyStatus, VerifyResult[]> {
	const groups = new Map<VerifyStatus, VerifyResult[]>();
	for (const result of results) {
		const status = getStatus(result);
		const existing = groups.get(status) ?? [];
		existing.push(result);
		groups.set(status, existing);
	}
	return groups;
}

function escapeCell(value: string): string {
	return value.replace(/\|/g, "\\|");
}

function formatDeclaredChange(result: VerifyResult): string {
	if (result.declaredBump === null) {
		return "—";
	}
	return `${result.declaredBefore ?? "?"} → ${result.declaredAfter ?? "?"} (${result.declaredBump})`;
}

export function formatVerifyMarkdown(report: VerifyReport): string {
	const lines: string[] = [];
	const now = report.generatedAt.split("T")[0];

	lines.push("# Skills Check Verify Report");
	lines.push("");
	lines.push(`Generated: ${now}`);
	lines.push("");

	lines.push("## Summary");
	lines.push("");
	lines.push("| Status | Count |");
	lines.push("|--------|-------|");
	lines.push(`| Passed | ${report.summary.passed} |`);
	lines.push(`| Failed | ${report.summary.failed} |`);
	lines.push(`| Skipped | ${report.summary.skipped} |`);
	lines.push(
		`| **Total** | **${report.summary.passed + report.summary.failed + report.summary.skipped}** |`
	);
	lines.push("");

	if (report.results.length === 0) {
		lines.push("No skills found to verify.");
		lines.push("");
		return lines.join("\n");
	}

	const statusOrder: VerifyStatus[] = ["failed", "passed", "skipped"];
	const grouped = groupByStatus(report.results);

	for (const status of statusOrder) {
		const results = grouped.get(status);
		if (!results || results.length === 0) {
			continue;
		}

		lines.push(`## ${status.charAt(0).toUpperCase() + status.slice(1)} (${results.length})`);
		lines.push("");
		lines.push("| Skill | File | Declared Change | Assessed Bump | LLM | Explanation |");
		lines.push("|-------|------|-----------------|---------------|-----|-------------|");

		for (const result of [...results].sort((a, b) => a.file.localeCompare(b.file))) {
			lines.push(
				`| ${escapeCell(result.skill)} | ${escapeCell(result.file)} | ${escapeCell(formatDeclaredChange(result))} | ${result.assessedBump} | ${result.llmUsed ? "Yes" : "No"} | ${escapeCell(result.explanation)} |`
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

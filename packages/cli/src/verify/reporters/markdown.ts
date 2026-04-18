import type { VerifyReport, VerifyResult } from "../types.js";

function formatResult(result: VerifyResult): string[] {
	const lines: string[] = [];
	const icon = result.match ? "PASS" : "FAIL";

	lines.push(`### ${result.skill} [${icon}]`);
	lines.push("");

	if (result.declaredBump) {
		lines.push(
			`**Declared change:** ${result.declaredBefore ?? "?"} -> ${result.declaredAfter ?? "?"} (${result.declaredBump})`
		);
	} else {
		lines.push("*No previous version for comparison*");
	}
	lines.push("");

	if (result.signals.length > 0) {
		lines.push("**Content analysis:**");
		lines.push("");
		lines.push("| Signal | Confidence | Bump | Source |");
		lines.push("|--------|------------|------|--------|");

		for (const signal of result.signals) {
			const conf = `${(signal.confidence * 100).toFixed(0)}%`;
			const reason = signal.reason.replace(/\|/g, "\\|");
			lines.push(`| ${reason} | ${conf} | ${signal.type} | ${signal.source} |`);
		}
		lines.push("");
	}

	if (result.declaredBump) {
		if (result.match) {
			lines.push(`**Assessment:** ${result.assessedBump.toUpperCase()} bump is appropriate`);
		} else {
			lines.push(
				`**Assessment:** ${result.declaredBump.toUpperCase()} bump appears ${result.assessedBump > result.declaredBump ? "INSUFFICIENT" : "EXCESSIVE"}. Recommended: ${result.assessedBump}`
			);
		}
	} else {
		lines.push(`**Suggested bump:** ${result.assessedBump}`);
	}

	if (result.explanation) {
		lines.push("");
		lines.push(`> ${result.explanation}`);
	}

	if (result.llmUsed) {
		lines.push("");
		lines.push("*LLM-assisted analysis*");
	}

	lines.push("");
	return lines;
}

export function formatVerifyMarkdown(report: VerifyReport): string {
	const lines: string[] = [];
	const now = report.generatedAt.split("T")[0];

	lines.push("# Skills Check Verify Report");
	lines.push("");
	lines.push(`Generated: ${now}`);
	lines.push("");

	// Summary table
	lines.push("## Summary");
	lines.push("");
	lines.push("| Status | Count |");
	lines.push("|--------|-------|");
	lines.push(`| Passed | ${report.summary.passed} |`);
	lines.push(`| Failed | ${report.summary.failed} |`);
	lines.push(`| Skipped | ${report.summary.skipped} |`);
	const total = report.summary.passed + report.summary.failed + report.summary.skipped;
	lines.push(`| **Total** | **${total}** |`);
	lines.push("");

	if (report.results.length === 0) {
		lines.push("No skills found to verify.");
		lines.push("");
		return lines.join("\n");
	}

	// Results
	lines.push("## Results");
	lines.push("");

	for (const result of report.results) {
		lines.push(...formatResult(result));
	}

	if (report.integrity) {
		lines.push("## Integrity");
		lines.push("");
		if (!report.integrity.lockFound) {
			lines.push("skills-lock.json not found.");
			lines.push("");
		} else {
			lines.push("| Skill | Status | Field | Expected | Actual |");
			lines.push("|-------|--------|-------|----------|--------|");
			for (const result of report.integrity.results) {
				lines.push(
					`| ${result.skill} | ${result.status} | ${result.field ?? ""} | ${result.expected ?? ""} | ${result.actual ?? ""} |`
				);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

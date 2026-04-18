import type { PolicyReport, PolicySeverity } from "../types.js";

export function formatPolicyMarkdown(report: PolicyReport): string {
	const lines: string[] = [];
	const now = report.generatedAt.split("T")[0];
	const exemptedViolations = report.exemptedViolations ?? [];

	lines.push("# Skills Check Policy Report");
	lines.push("");
	lines.push(`Generated: ${now}`);
	lines.push(`Policy: ${report.policyFile}`);
	lines.push("");

	// Summary table
	lines.push("## Summary");
	lines.push("");
	lines.push("| Severity | Count |");
	lines.push("|----------|-------|");
	lines.push(`| Blocked | ${report.summary.blocked} |`);
	lines.push(`| Violations | ${report.summary.violations} |`);
	lines.push(`| Warnings | ${report.summary.warnings} |`);
	lines.push(`| Exempted | ${exemptedViolations.length} |`);
	const total = report.summary.blocked + report.summary.violations + report.summary.warnings;
	lines.push(`| **Total** | **${total}** |`);
	lines.push("");
	lines.push(`Files checked: ${report.files}`);
	lines.push("");

	if (report.findings.length === 0 && report.required.every((r) => r.satisfied)) {
		lines.push("All skills comply with policy.");
		if (exemptedViolations.length > 0 && !report.showExemptions) {
			lines.push("");
			lines.push(
				`${exemptedViolations.length} finding(s) were exempted. Re-run with --show-exemptions to display.`
			);
		}
		lines.push("");
		return lines.join("\n");
	}

	// Findings by severity
	const severityOrder: PolicySeverity[] = ["blocked", "violation", "warning"];

	for (const severity of severityOrder) {
		const findings = report.findings.filter((f) => f.severity === severity);
		if (findings.length === 0) {
			continue;
		}

		const label = severity.charAt(0).toUpperCase() + severity.slice(1);
		lines.push(`## ${label} (${findings.length})`);
		lines.push("");
		lines.push("| File | Rule | Message |");
		lines.push("|------|------|---------|");

		for (const f of findings) {
			const escapedMessage = f.message.replace(/\|/g, "\\|");
			const lineRef = f.line ? ` (line ${f.line})` : "";
			lines.push(`| ${f.file}${lineRef} | ${f.rule} | ${escapedMessage} |`);
		}

		lines.push("");
	}

	if (exemptedViolations.length > 0) {
		lines.push("## Exempted Findings");
		lines.push("");

		if (!report.showExemptions) {
			lines.push(
				`${exemptedViolations.length} finding(s) were exempted. Re-run with --show-exemptions to display.`
			);
			lines.push("");
		} else {
			lines.push("| Skill | File | Rule | Reason | Expires |");
			lines.push("|-------|------|------|--------|---------|");

			for (const finding of exemptedViolations) {
				const skill = finding.skill ?? finding.exemption.skill;
				const reason = finding.exemption.reason.replace(/\|/g, "\\|");
				const lineRef = finding.line ? ` (line ${finding.line})` : "";
				lines.push(
					`| ${skill} | ${finding.file}${lineRef} | ${finding.rule} | ${reason} | ${finding.exemption.expires ?? ""} |`
				);
			}

			lines.push("");
		}
	}

	// Required skills section
	if (report.required.length > 0) {
		lines.push("## Required Skills");
		lines.push("");
		lines.push("| Skill | Status |");
		lines.push("|-------|--------|");

		for (const r of report.required) {
			const status = r.satisfied ? "Installed" : "**MISSING**";
			lines.push(`| ${r.skill} | ${status} |`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

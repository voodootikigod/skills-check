import type { PolicyReport } from "../types.js";

export function formatPolicyJson(report: PolicyReport): string {
	return JSON.stringify(
		{
			...report,
			exemptedViolations: report.exemptedViolations ?? [],
			exemptions: report.exemptions ?? [],
		},
		null,
		2
	);
}

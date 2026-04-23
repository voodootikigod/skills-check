import type { FixReport } from "../types.js";

export function formatFixJson(report: FixReport): string {
	return JSON.stringify(report, null, 2);
}

import type { FixReport } from "../types.ts";

export function formatFixJson(report: FixReport): string {
	return JSON.stringify(report, null, 2);
}

import type { DoctorReport } from "../types.ts";

export function formatDoctorJson(report: DoctorReport): string {
	return JSON.stringify(report, null, 2);
}

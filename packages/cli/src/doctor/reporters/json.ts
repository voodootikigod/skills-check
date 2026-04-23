import type { DoctorReport } from "../types.js";

export function formatDoctorJson(report: DoctorReport): string {
	return JSON.stringify(report, null, 2);
}

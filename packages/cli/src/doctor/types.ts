export type CheckStatus = "pass" | "warn" | "fail";

export type CheckCategory = "environment" | "network" | "isolation" | "llm" | "project";

export interface DoctorCheck {
	category: CheckCategory;
	label: string;
	message: string;
	status: CheckStatus;
}

export interface DoctorReport {
	checks: DoctorCheck[];
	errors: number;
	generatedAt: string;
	warnings: number;
}

export interface DoctorOptions {
	ci?: boolean;
	format?: "terminal" | "json";
}

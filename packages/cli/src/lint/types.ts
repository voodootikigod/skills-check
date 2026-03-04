export interface LintFinding {
	file: string;
	field: string;
	level: "error" | "warning" | "info";
	message: string;
	fixable: boolean;
}

export interface LintReport {
	files: number;
	findings: LintFinding[];
	errors: number;
	warnings: number;
	infos: number;
	fixed: number;
	generatedAt: string;
}

export interface LintOptions {
	fix?: boolean;
	ci?: boolean;
	failOn?: "error" | "warning";
	format?: "terminal" | "json";
	output?: string;
}

export interface FixResult {
	description: string;
	fixer: string;
}

export interface FileFixResult {
	applied: FixResult[];
	file: string;
}

export interface FixReport {
	files: number;
	generatedAt: string;
	results: FileFixResult[];
	totalFixes: number;
	written: boolean;
}

export interface FixOptions {
	format?: "terminal" | "json";
	write?: boolean;
}

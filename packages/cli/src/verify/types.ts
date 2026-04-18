import type { IntegrityResult } from "../lockfile/index.js";

export type VersionBump = "major" | "minor" | "patch";

export interface ChangeSignal {
	confidence: number;
	reason: string;
	source: "heuristic" | "llm";
	type: VersionBump;
}

export interface VerifyResult {
	assessedBump: VersionBump;
	declaredAfter: string | null;
	declaredBefore: string | null;
	declaredBump: VersionBump | null;
	explanation: string;
	file: string;
	llmUsed: boolean;
	match: boolean;
	signals: ChangeSignal[];
	skill: string;
}

export interface VerifyReport {
	generatedAt: string;
	integrity?: {
		lockFound: boolean;
		results: IntegrityResult[];
		summary: { missing: number; modified: number; new: number; ok: number };
	};
	results: VerifyResult[];
	summary: { passed: number; failed: number; skipped: number };
}

export interface VerifyOptions {
	after?: string;
	all?: boolean;
	before?: string;
	checkIntegrity?: boolean;
	format?: "terminal" | "json" | "markdown" | "sarif";
	model?: string;
	output?: string;
	provider?: string;
	skill?: string;
	skipLlm?: boolean;
	suggest?: boolean;
}

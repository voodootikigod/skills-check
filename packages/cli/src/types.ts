export type { Registry, RegistryProduct } from "@skills-check/schema";

/**
 * Result of checking a single product against npm
 */
export interface CheckResult {
	changelog?: string;
	displayName: string;
	latestVersion: string;
	package: string;
	product: string;
	severity: "major" | "minor" | "patch" | "current";
	skills: string[];
	stale: boolean;
	verifiedVersion: string;
}

/**
 * A parsed entry from the `compatibility` frontmatter field.
 */
export interface CompatibilityEntry {
	package: string;
	raw: string; // original text fragment
	version?: string; // semver or range
}

/**
 * Scanned skill from SKILL.md frontmatter
 */
export interface ScannedSkill {
	allowedTools?: string;
	compatibility?: string;
	compatibilityEntries?: CompatibilityEntry[];
	name: string;
	path: string;
	product?: string;
	/** @deprecated Use `resolvedPackages` from compatibility field instead */
	productVersion?: string;
	resolvedPackages?: CompatibilityEntry[];
}

/**
 * npm registry response (partial)
 */
export interface NpmDistTags {
	latest: string;
	[tag: string]: string;
}

/**
 * Result of refreshing a single skill file via LLM
 */
export interface RefreshResult {
	applied: boolean;
	breakingChanges: boolean;
	changes: Array<{ section: string; description: string }>;
	confidence: "high" | "medium" | "low";
	product: string;
	skillPath: string;
	summary: string;
	updatedContent: string;
}

/**
 * Exit codes for CLI
 */
export const ExitCode = {
	OK: 0,
	STALE: 1,
	ERROR: 2,
} as const;

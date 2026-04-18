/**
 * Registry format: skills-check.json
 */
export interface Registry {
	$schema?: string;
	lastCheck?: string;
	products: Record<string, RegistryProduct>;
	skillsDir?: string;
	version: number;
}

export interface RegistryProduct {
	agents?: string[];
	changelog?: string;
	displayName: string;
	package: string;
	skills: string[];
	verifiedAt: string;
	verifiedVersion: string;
}

/**
 * Detection method used to identify a skill fingerprint.
 * Ordered by confidence level (highest to lowest).
 */
export type DetectionMethod =
	| "watermark"
	| "frontmatter_hash"
	| "content_hash"
	| "prefix_hash"
	| "tool_schema"
	| "function_signature";

/**
 * Telemetry event emitted when a skill is detected in an LLM request.
 * Flat structure — aligned with skills-trace runtime output.
 */
export interface SkillTelemetryEvent {
	/** Agent identifier */
	agentId?: string;
	/** Confidence score between 0 and 1 */
	confidence: number;
	/** Detection method that matched */
	detection: DetectionMethod;
	/** Deployment environment */
	environment?: string;
	/** Detection latency in milliseconds */
	latencyMs?: number;
	/** Model being targeted */
	model?: string;
	/** Project identifier */
	project?: string;
	/** Registry source identifier */
	registry?: string;
	/** Request identifier for deduplication */
	requestId?: string;
	/** Schema version for forward compatibility */
	schemaVersion: 1;
	/** Skill identity URI, e.g. "react" or "skill://acme/pr-review" */
	skillId: string;
	/** Skill tokens consumed in this request */
	skillTokens?: number;
	/** Team identifier */
	team?: string;
	/** Tenant identifier */
	tenantId?: string;
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Total prompt tokens in the request */
	totalPromptTokens?: number;
	/** User identifier */
	user?: string;
	/** Skill version */
	version: string;
}

/**
 * A registry of fingerprints for installed skills.
 */
export interface FingerprintRegistry {
	/** Array of fingerprint entries */
	entries: FingerprintEntry[];
	/** ISO 8601 timestamp of when the registry was generated */
	generatedAt: string;
	/** Base64-encoded Ed25519 signature over canonical form */
	signature?: string;
	/** Key identifier for the signing key */
	signedBy?: string;
	/** Schema version (always 1) */
	version: 1;
}

export interface FingerprintEntry {
	/** SHA-256 of normalized full content */
	contentHash?: string;
	/** SHA-256 of raw YAML frontmatter */
	frontmatterHash?: string;
	/** Function signatures for detection */
	functionSignatures?: string[];
	/** File path (set by skills-check, omitted in runtime registries) */
	path?: string;
	/** SHA-256 of first 500 tokens of normalized content */
	prefixHash?: string;
	/** Registry source identifier */
	registry?: string;
	/** Skill identity URI */
	skillId: string;
	/** Source origin (e.g. "@acme/react") */
	source?: string;
	/** Token count of the full skill content */
	tokenCount?: number;
	/** Tool schemas for detection */
	toolSchemas?: Array<{
		name: string;
		parametersHash: string;
	}>;
	/** Skill version */
	version: string;
	/** Watermark string if present */
	watermark?: string;
	/** Skill status for lifecycle management */
	status?: "active" | "deprecated" | "revoked";
	/** Deprecation message when status is deprecated */
	deprecatedMessage?: string;
}

// ---------------------------------------------------------------------------
// Lock file format: skills-lock.json (v2)
// ---------------------------------------------------------------------------

/**
 * A single skill entry in the lock file, capturing the full fingerprint
 * state at the time of resolution.
 */
export interface SkillsLockFileEntry {
	/** SHA-256 content hash from fingerprint */
	contentHash: string;
	/** Deprecation message if status is deprecated */
	deprecatedMessage?: string;
	/** Deprecation sunset date (ISO 8601) if status is deprecated */
	deprecatedSunsetDate?: string;
	/** SHA-256 frontmatter hash from fingerprint */
	frontmatterHash: string;
	/** Skill name (directory basename or frontmatter name) */
	name: string;
	/** SHA-256 prefix hash from fingerprint */
	prefixHash: string;
	/** ISO 8601 timestamp when this entry was resolved */
	resolvedAt: string;
	/** Resolved source URI (file path, git URL, registry URL) */
	source: string;
	/** Skill status */
	status?: "active" | "deprecated" | "revoked";
	/** Estimated token count at time of lock */
	tokenCount?: number;
	/** Semver version from frontmatter, if present */
	version?: string;
	/** Watermark string injected by fingerprint command */
	watermark?: string;
}

/**
 * Lock file format for deterministic skill resolution.
 * Analogous to package-lock.json / Cargo.lock for skills.
 */
export interface SkillsLockFile {
	/** ISO 8601 timestamp of last generation */
	generatedAt: string;
	/** Tool and version that generated this lock file */
	generatedBy: string;
	/** Lock file format version for forward compatibility */
	lockfileVersion: 2;
	/** Map of skill name → locked entry */
	skills: Record<string, SkillsLockFileEntry>;
}

// ---------------------------------------------------------------------------
// Policy exemptions
// ---------------------------------------------------------------------------

/**
 * An exemption entry that suppresses a specific policy violation
 * for a skill (or glob pattern of skills).
 */
export interface PolicyExemption {
	/** ISO 8601 expiry date — exemption auto-expires and violation becomes active */
	expires?: string;
	/** Who granted the exemption */
	grantedBy?: string;
	/** Human-readable reason for the exemption */
	reason: string;
	/** Validator rule ID to exempt (e.g. "banned-pattern", "source-not-allowed") */
	rule: string;
	/** Skill name or glob pattern (e.g. "my-skill" or "internal/*") */
	skill: string;
}

// ---------------------------------------------------------------------------
// Revocation list: .skill-revocations.json
// ---------------------------------------------------------------------------

/**
 * A single revocation entry marking a skill as compromised.
 */
export interface RevocationEntry {
	/** Link to advisory or disclosure */
	advisory?: string;
	/** Human-readable reason for revocation */
	reason: string;
	/** ISO 8601 timestamp of when the skill was revoked */
	revokedAt: string;
	/** Severity of the revocation */
	severity: "critical" | "high" | "medium" | "low";
	/** Skill name or identifier */
	skill: string;
}

/**
 * Local revocation list for marking skills as compromised.
 */
export interface RevocationList {
	/** Revocation entries */
	entries: RevocationEntry[];
	/** Format version for forward compatibility */
	revocationVersion: 1;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

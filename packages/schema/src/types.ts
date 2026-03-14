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
 * Telemetry event emitted when a skill is detected in an LLM request.
 */
export interface SkillTelemetryEvent {
	confidence: number;
	detection: "watermark" | "frontmatter_hash" | "content_hash" | "prefix_hash";
	org?: {
		user?: string;
		team?: string;
		project?: string;
	};
	request: {
		id: string;
		model: string;
		skill_tokens: number;
		total_prompt_tokens?: number;
	};
	schema_version: 1;
	skill: {
		name: string;
		version: string;
		source?: string;
	};
	timestamp: string;
}

/**
 * A registry of fingerprints for installed skills.
 */
export interface FingerprintRegistry {
	generated: string;
	skills: FingerprintEntry[];
	version: 1;
}

export interface FingerprintEntry {
	fingerprints: {
		watermark?: string;
		frontmatter_sha256: string;
		content_sha256: string;
		content_prefix_sha256: string;
	};
	name: string;
	path: string;
	source?: string;
	token_count: number;
	version: string;
}

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Configuration loaded from .skillscheckrc.yml files.
 * CLI flags always override these values.
 */
export interface SkillsCheckConfig {
	/** Default --fail-on severity for audit */
	audit?: { failOn?: string; skipUrls?: boolean; uniqueOnly?: boolean };
	/** Default budget settings */
	budget?: { maxTokens?: number; model?: string; detailed?: boolean };
	/** Default output format for all commands */
	format?: string;
	/** Default --fail-on level for lint */
	lint?: { failOn?: string; fix?: boolean };
	/** Default --fail-on severity for policy */
	policy?: { failOn?: string; policyPath?: string };
	/** Default test settings */
	test?: {
		agent?: string;
		trials?: number;
		timeout?: number;
		provider?: string;
		model?: string;
	};
	/** Default verify settings */
	verify?: { skipLlm?: boolean; provider?: string; model?: string };
}

/**
 * Dynamically import js-yaml (transitive dep via gray-matter).
 */
async function loadYaml(): Promise<{
	load: (str: string, opts?: { schema: unknown }) => unknown;
	JSON_SCHEMA: unknown;
}> {
	const mod = await import("js-yaml");
	return (mod.default ?? mod) as {
		load: (str: string, opts?: { schema: unknown }) => unknown;
		JSON_SCHEMA: unknown;
	};
}

const CONFIG_FILE_NAME = ".skillscheckrc.yml";

/**
 * Walk up the directory tree to find a project-level config file.
 */
async function findProjectConfig(startDir: string): Promise<string | null> {
	let current = resolve(startDir);
	const root = resolve("/");

	while (current !== root) {
		const candidate = join(current, CONFIG_FILE_NAME);
		try {
			await stat(candidate);
			return candidate;
		} catch {
			// Not found, continue walking up
		}
		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}

	return null;
}

/**
 * Get the user-level config path (~/.config/skills-check/config.yml).
 */
function getUserConfigPath(): string {
	return join(homedir(), ".config", "skills-check", "config.yml");
}

/**
 * Parse a YAML config file into a SkillsCheckConfig.
 * Returns an empty config on parse errors (graceful degradation).
 */
async function parseConfigFile(filePath: string): Promise<SkillsCheckConfig> {
	try {
		const content = await readFile(filePath, "utf-8");
		const yaml = await loadYaml();
		const raw = yaml.load(content, { schema: yaml.JSON_SCHEMA });

		if (raw === null || raw === undefined || typeof raw !== "object") {
			return {};
		}

		return raw as SkillsCheckConfig;
	} catch {
		return {};
	}
}

/**
 * Shallow merge two configs. Values in `override` take precedence.
 */
function mergeConfigs(base: SkillsCheckConfig, override: SkillsCheckConfig): SkillsCheckConfig {
	return {
		format: override.format ?? base.format,
		audit: override.audit ?? base.audit,
		lint: override.lint ?? base.lint,
		policy: override.policy ?? base.policy,
		budget: override.budget ?? base.budget,
		verify: override.verify ?? base.verify,
		test: override.test ?? base.test,
	};
}

/**
 * Load configuration with 3-level cascade: project config > user config.
 * CLI flags are applied separately by each command (they always win).
 *
 * @param cwd - Directory to start searching for project config
 */
export async function loadConfig(cwd: string): Promise<SkillsCheckConfig> {
	// Level 1: User-level config (~/.config/skills-check/config.yml)
	const userConfigPath = getUserConfigPath();
	const userConfig = await parseConfigFile(userConfigPath);

	// Level 2: Project-level config (walk up from cwd)
	const projectConfigPath = await findProjectConfig(cwd);
	const projectConfig = projectConfigPath ? await parseConfigFile(projectConfigPath) : {};

	// Project overrides user
	return mergeConfigs(userConfig, projectConfig);
}

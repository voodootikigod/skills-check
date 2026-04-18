import { createRequire } from "node:module";
import type { SkillsLockFile } from "@skills-check/schema";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

function getGeneratedBy(): string {
	return `skills-check@${version}`;
}

function getRecord(value: unknown, message: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(message);
	}

	return value as Record<string, unknown>;
}

/**
 * Migrate the legacy v1 stub lock file into the v2 schema.
 */
export function migrateLockFileV1(v1: unknown): SkillsLockFile {
	const root = getRecord(v1, "Lock file is not a valid object.");

	if (root.version !== 1) {
		throw new Error(`Unsupported lock file version: ${String(root.version)} (expected 1)`);
	}

	const skills = getRecord(root.skills, 'Lock file is missing "skills" object.');
	const resolvedAt = new Date().toISOString();

	return {
		lockfileVersion: 2,
		generatedBy: getGeneratedBy(),
		generatedAt: resolvedAt,
		skills: Object.fromEntries(
			Object.entries(skills)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([name, rawEntry]) => {
					const entry = getRecord(rawEntry, `Invalid legacy lock file entry: ${name}`);
					const source = entry.source;
					const computedHash = entry.computedHash;

					if (typeof source !== "string" || source.length === 0) {
						throw new Error(`Legacy lock file entry "${name}" is missing source.`);
					}

					if (typeof computedHash !== "string" || computedHash.length === 0) {
						throw new Error(`Legacy lock file entry "${name}" is missing computedHash.`);
					}

					return [
						name,
						{
							name,
							source,
							contentHash: computedHash,
							frontmatterHash: computedHash,
							prefixHash: computedHash,
							resolvedAt,
						},
					];
				})
		),
	};
}

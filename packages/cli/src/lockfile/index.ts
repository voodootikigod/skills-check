import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type {
	FingerprintEntry,
	FingerprintRegistry,
	SkillsLockFile,
	SkillsLockFileEntry,
} from "@skills-check/schema";
import { migrateLockFileV1 } from "./migrate.js";

const LOCK_FILE_NAME = "skills-lock.json";
const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const ENTRY_DIFF_FIELDS = [
	"source",
	"contentHash",
	"frontmatterHash",
	"prefixHash",
	"watermark",
	"tokenCount",
	"version",
	"status",
	"deprecatedMessage",
	"deprecatedSunsetDate",
] as const;

const INTEGRITY_HASH_FIELDS = ["contentHash", "frontmatterHash", "prefixHash"] as const;

type DiffableEntryField = (typeof ENTRY_DIFF_FIELDS)[number];
type IntegrityHashField = (typeof INTEGRITY_HASH_FIELDS)[number];
type LockStatus = SkillsLockFileEntry["status"];

export interface LockFileDiff {
	added: string[];
	removed: string[];
	changed: Array<{
		name: string;
		field: string;
		from: string;
		to: string;
	}>;
	unchanged: string[];
}

export interface IntegrityResult {
	actual?: string;
	expected?: string;
	field?: IntegrityHashField;
	skill: string;
	status: "ok" | "modified" | "missing" | "new";
}

function getGeneratedBy(): string {
	return `skills-check@${version}`;
}

function getLockFilePath(dir: string): string {
	return join(dir, LOCK_FILE_NAME);
}

function stringifyFieldValue(value: string | number | undefined): string {
	return value === undefined ? "<unset>" : String(value);
}

function getRecord(value: unknown, message: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(message);
	}

	return value as Record<string, unknown>;
}

function getOptionalString(value: unknown, fieldName: string): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "string") {
		throw new Error(`Lock file entry field "${fieldName}" must be a string.`);
	}

	return value;
}

function getOptionalNumber(value: unknown, fieldName: string): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "number") {
		throw new Error(`Lock file entry field "${fieldName}" must be a number.`);
	}

	return value;
}

function getRequiredString(value: unknown, fieldName: string, entryName: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Lock file entry "${entryName}" is missing required field: ${fieldName}`);
	}

	return value;
}

function getOptionalStatus(value: unknown, fieldName: string): LockStatus {
	const status = getOptionalString(value, fieldName);
	if (status === undefined) {
		return undefined;
	}

	if (status === "active" || status === "deprecated" || status === "revoked") {
		return status;
	}

	throw new Error(`Lock file entry field "${fieldName}" has invalid status: ${status}`);
}

function validateLockEntry(name: string, value: unknown): SkillsLockFileEntry {
	const entry = getRecord(value, `Invalid lock file entry: ${name}`);
	const requiredFields = {
		name: getRequiredString(entry.name, "name", name),
		source: getRequiredString(entry.source, "source", name),
		contentHash: getRequiredString(entry.contentHash, "contentHash", name),
		frontmatterHash: getRequiredString(entry.frontmatterHash, "frontmatterHash", name),
		prefixHash: getRequiredString(entry.prefixHash, "prefixHash", name),
		resolvedAt: getRequiredString(entry.resolvedAt, "resolvedAt", name),
	};
	const status = getOptionalStatus(entry.status, `${name}.status`);

	return {
		name: requiredFields.name,
		source: requiredFields.source,
		contentHash: requiredFields.contentHash,
		frontmatterHash: requiredFields.frontmatterHash,
		prefixHash: requiredFields.prefixHash,
		resolvedAt: requiredFields.resolvedAt,
		watermark: getOptionalString(entry.watermark, `${name}.watermark`),
		tokenCount: getOptionalNumber(entry.tokenCount, `${name}.tokenCount`),
		version: getOptionalString(entry.version, `${name}.version`),
		status,
		deprecatedMessage: getOptionalString(entry.deprecatedMessage, `${name}.deprecatedMessage`),
		deprecatedSunsetDate: getOptionalString(
			entry.deprecatedSunsetDate,
			`${name}.deprecatedSunsetDate`
		),
	};
}

function validateLockFile(value: unknown): SkillsLockFile {
	const root = getRecord(value, "Lock file is not a valid object.");

	if (root.lockfileVersion !== 2) {
		throw new Error(
			`Unsupported lock file version: ${String(root.lockfileVersion)} (expected 2)`
		);
	}

	if (typeof root.generatedBy !== "string" || root.generatedBy.length === 0) {
		throw new Error('Lock file is missing "generatedBy" string.');
	}

	if (typeof root.generatedAt !== "string" || root.generatedAt.length === 0) {
		throw new Error('Lock file is missing "generatedAt" string.');
	}

	const skills = getRecord(root.skills, 'Lock file is missing "skills" object.');

	return {
		lockfileVersion: 2,
		generatedBy: root.generatedBy,
		generatedAt: root.generatedAt,
		skills: Object.fromEntries(
			Object.entries(skills)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([name, entry]) => [name, validateLockEntry(name, entry)])
		),
	};
}

function sortLockSkills(skills: Record<string, SkillsLockFileEntry>): Record<string, SkillsLockFileEntry> {
	return Object.fromEntries(
		Object.entries(skills).sort(([left], [right]) => left.localeCompare(right))
	);
}

function isEntryFieldUnchanged(
	existing: SkillsLockFileEntry | undefined,
	next: SkillsLockFileEntry
): boolean {
	if (!existing) {
		return false;
	}

	return ENTRY_DIFF_FIELDS.every((field) => existing[field] === next[field]);
}

function toLockEntry(
	entry: FingerprintEntry,
	existing: SkillsLockFileEntry | undefined,
	resolvedAt: string
): SkillsLockFileEntry {
	if (!entry.contentHash || !entry.frontmatterHash || !entry.prefixHash) {
		throw new Error(`Fingerprint entry "${entry.skillId}" is missing one or more required hashes.`);
	}

	const nextEntry: SkillsLockFileEntry = {
		name: entry.skillId,
		source: entry.source ?? entry.path ?? entry.skillId,
		contentHash: entry.contentHash,
		frontmatterHash: entry.frontmatterHash,
		prefixHash: entry.prefixHash,
		watermark: entry.watermark,
		tokenCount: entry.tokenCount,
		resolvedAt,
		version: entry.version,
		status: entry.status,
		deprecatedMessage: entry.deprecatedMessage,
		deprecatedSunsetDate: existing?.deprecatedSunsetDate,
	};

	const existingResolvedAt = existing?.resolvedAt;
	if (existingResolvedAt && isEntryFieldUnchanged(existing, nextEntry)) {
		return {
			...nextEntry,
			resolvedAt: existingResolvedAt,
		};
	}

	return nextEntry;
}

function createBaseLockFile(lock: SkillsLockFile | null, generatedAt?: string): SkillsLockFile {
	return {
		lockfileVersion: 2,
		generatedBy: getGeneratedBy(),
		generatedAt: generatedAt ?? lock?.generatedAt ?? new Date().toISOString(),
		skills: sortLockSkills(lock?.skills ?? {}),
	};
}

export function readLockFile(dir: string): SkillsLockFile | null {
	const filePath = getLockFilePath(dir);

	let raw: string;
	try {
		raw = readFileSync(filePath, "utf-8");
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return null;
		}

		throw error;
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new Error(`Invalid JSON in lock file: ${filePath}`);
	}

	if (data && typeof data === "object" && !Array.isArray(data) && "lockfileVersion" in data) {
		return validateLockFile(data);
	}

	return migrateLockFileV1(data);
}

export function writeLockFile(dir: string, lock: SkillsLockFile): void {
	const filePath = getLockFilePath(dir);
	const content = `${JSON.stringify(
		{
			...lock,
			generatedBy: getGeneratedBy(),
			skills: sortLockSkills(lock.skills),
		},
		null,
		2
	)}\n`;

	writeFileSync(filePath, content, "utf-8");
}

export function updateLockEntry(lock: SkillsLockFile, entry: FingerprintEntry): SkillsLockFile {
	const generatedAt = new Date().toISOString();
	const nextLock = createBaseLockFile(lock, generatedAt);
	const existing = lock.skills[entry.skillId];

	return {
		...nextLock,
		skills: sortLockSkills({
			...nextLock.skills,
			[entry.skillId]: toLockEntry(entry, existing, generatedAt),
		}),
	};
}

export function synchronizeLockFile(
	lock: SkillsLockFile | null,
	registry: FingerprintRegistry
): SkillsLockFile {
	let nextLock = createBaseLockFile(lock, registry.generatedAt);
	const currentSkillIds = new Set<string>();

	for (const entry of registry.entries) {
		currentSkillIds.add(entry.skillId);
		nextLock = updateLockEntry(nextLock, entry);
	}

	return {
		...nextLock,
		generatedAt: registry.generatedAt,
		skills: sortLockSkills(
			Object.fromEntries(
				Object.entries(nextLock.skills).filter(([name]) => currentSkillIds.has(name))
			)
		),
	};
}

export function diffLockFiles(prev: SkillsLockFile, next: SkillsLockFile): LockFileDiff {
	const prevNames = new Set(Object.keys(prev.skills));
	const nextNames = new Set(Object.keys(next.skills));
	const names = Array.from(new Set([...prevNames, ...nextNames])).sort((left, right) =>
		left.localeCompare(right)
	);

	const diff: LockFileDiff = {
		added: [],
		removed: [],
		changed: [],
		unchanged: [],
	};

	for (const name of names) {
		const previousEntry = prev.skills[name];
		const nextEntry = next.skills[name];

		if (!previousEntry && nextEntry) {
			diff.added.push(name);
			continue;
		}

		if (previousEntry && !nextEntry) {
			diff.removed.push(name);
			continue;
		}

		if (!previousEntry || !nextEntry) {
			continue;
		}

		const entryChanges = ENTRY_DIFF_FIELDS.flatMap((field) => {
			const previousValue = previousEntry[field as DiffableEntryField];
			const nextValue = nextEntry[field as DiffableEntryField];

			if (previousValue === nextValue) {
				return [];
			}

			return [
				{
					name,
					field,
					from: stringifyFieldValue(previousValue),
					to: stringifyFieldValue(nextValue),
				},
			];
		});

		if (entryChanges.length === 0) {
			diff.unchanged.push(name);
			continue;
		}

		diff.changed.push(...entryChanges);
	}

	return diff;
}

export function verifyIntegrity(
	lock: SkillsLockFile,
	currentFingerprints: FingerprintRegistry
): IntegrityResult[] {
	const currentBySkill = new Map(
		currentFingerprints.entries.map((entry) => [entry.skillId, entry] as const)
	);
	const skillNames = Array.from(
		new Set([...Object.keys(lock.skills), ...currentFingerprints.entries.map((entry) => entry.skillId)])
	).sort((left, right) => left.localeCompare(right));

	return skillNames.map((skill) => {
		const lockedEntry = lock.skills[skill];
		const currentEntry = currentBySkill.get(skill);

		if (!lockedEntry && currentEntry) {
			return {
				skill,
				status: "new",
			};
		}

		if (lockedEntry && !currentEntry) {
			return {
				skill,
				status: "missing",
			};
		}

		if (!lockedEntry || !currentEntry) {
			return {
				skill,
				status: "ok",
			};
		}

		for (const field of INTEGRITY_HASH_FIELDS) {
			const expected = lockedEntry[field];
			const actual = currentEntry[field];

			if (actual !== expected) {
				return {
					skill,
					status: "modified",
					field,
					expected,
					actual,
				};
			}
		}

		return {
			skill,
			status: "ok",
		};
	});
}

export { LOCK_FILE_NAME, migrateLockFileV1 };

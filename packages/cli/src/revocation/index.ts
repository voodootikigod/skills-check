import { readFileSync } from "node:fs";
import type {
	FingerprintRegistry,
	RevocationEntry,
	RevocationList,
} from "@skills-check/schema";
import type { AuditFinding } from "../audit/types.js";

export interface RevocationMatch {
	entry: RevocationEntry;
	skill: string;
}

export function readRevocationList(path: string): RevocationList | null {
	let raw: string;

	try {
		raw = readFileSync(path, "utf-8");
	} catch {
		return null;
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new Error(`Invalid JSON in revocation list: ${path}`);
	}

	return validateRevocationList(data, path);
}

export function checkRevocations(skills: string[], revocations: RevocationList): RevocationMatch[] {
	const knownSkills = new Set(skills);

	return revocations.entries
		.filter((entry) => knownSkills.has(entry.skill))
		.map((entry) => ({
			entry,
			skill: entry.skill,
		}));
}

export function createRevocationAuditFindings(
	registry: FingerprintRegistry,
	revocations: RevocationList
): AuditFinding[] {
	const pathBySkill = new Map(registry.entries.map((entry) => [entry.skillId, entry.path]));

	return checkRevocations(
		registry.entries.map((entry) => entry.skillId),
		revocations
	).map(({ skill, entry }) => ({
		category: "revoked-skill",
		evidence: entry.reason,
		file: pathBySkill.get(skill) ?? skill,
		line: 1,
		message: `Skill "${skill}" has been revoked`,
		note: buildRevocationNote(entry),
		severity: entry.severity,
	}));
}

function buildRevocationNote(entry: RevocationEntry): string {
	const parts = [`revoked at ${entry.revokedAt}`];

	if (entry.advisory) {
		parts.push(`advisory: ${entry.advisory}`);
	}

	return parts.join("; ");
}

function validateRevocationList(data: unknown, path: string): RevocationList {
	if (!data || typeof data !== "object") {
		throw new Error(`Revocation list is not a valid object: ${path}`);
	}

	const revocations = data as Record<string, unknown>;

	if (revocations.revocationVersion !== 1) {
		throw new Error(
			`Unsupported revocation list version: ${String(revocations.revocationVersion)} (expected 1)`
		);
	}

	if (typeof revocations.updatedAt !== "string") {
		throw new Error(`Revocation list is missing "updatedAt": ${path}`);
	}

	if (!Array.isArray(revocations.entries)) {
		throw new Error(`Revocation list is missing "entries" array: ${path}`);
	}

	for (const [index, entry] of revocations.entries.entries()) {
		validateRevocationEntry(entry, index);
	}

	return revocations as unknown as RevocationList;
}

function validateRevocationEntry(entry: unknown, index: number): void {
	if (!entry || typeof entry !== "object") {
		throw new Error(`Invalid revocation entry at index ${index}`);
	}

	const revocation = entry as Record<string, unknown>;
	const requiredFields = ["skill", "reason", "revokedAt", "severity"] as const;

	for (const field of requiredFields) {
		if (typeof revocation[field] !== "string" || revocation[field].length === 0) {
			throw new Error(`Revocation entry ${index} is missing required field: ${field}`);
		}
	}

	if (!isRevocationSeverity(revocation.severity)) {
		throw new Error(`Invalid revocation severity at index ${index}: ${String(revocation.severity)}`);
	}

	if (
		revocation.advisory !== undefined &&
		(typeof revocation.advisory !== "string" || revocation.advisory.length === 0)
	) {
		throw new Error(`Revocation entry ${index} has invalid advisory`);
	}
}

function isRevocationSeverity(value: unknown): value is RevocationEntry["severity"] {
	return value === "critical" || value === "high" || value === "medium" || value === "low";
}

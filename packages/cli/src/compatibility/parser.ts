/**
 * Parse the `compatibility` frontmatter field into structured entries.
 *
 * Supports formats like:
 *   "next@^15.0.0, react@19.0.0, docker"
 *   "@vercel/blob@4.0.0"
 *   "next@>=14.0.0, network"
 */

import type { CompatibilityEntry } from "../types.js";

const PACKAGE_VERSION_RE = /^(@?[\w][\w./-]*)@(.+)$/;

/**
 * Parse a compatibility string into structured entries.
 * Never throws — unparseable input returns an empty array.
 */
export function parseCompatibility(value: string): CompatibilityEntry[] {
	if (!value || typeof value !== "string") {
		return [];
	}

	const tokens = value
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);

	return tokens.map((token) => {
		const match = PACKAGE_VERSION_RE.exec(token);
		if (match) {
			return {
				package: match[1],
				version: match[2],
				raw: token,
			};
		}
		return {
			package: token,
			version: undefined,
			raw: token,
		};
	});
}

/**
 * Extract only entries that have a version (i.e., package@semver).
 */
export function extractVersionedPackages(entries: CompatibilityEntry[]): CompatibilityEntry[] {
	return entries.filter((e) => e.version !== undefined);
}

/**
 * Format entries back to a compatibility string (round-trip).
 */
export function formatCompatibility(entries: CompatibilityEntry[]): string {
	return entries.map((e) => (e.version ? `${e.package}@${e.version}` : e.package)).join(", ");
}

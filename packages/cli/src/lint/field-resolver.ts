/**
 * Resolve a frontmatter field from both top-level and metadata locations.
 *
 * The Agent Skills spec defines exactly 6 top-level fields:
 * name, description, license, compatibility, allowed-tools, metadata.
 *
 * All other fields (author, repository, version, keywords, etc.) belong
 * in the metadata dict. This resolver accepts both locations for backward
 * compatibility, preferring top-level when present.
 */

/**
 * The 6 fields defined by the Agent Skills specification.
 * Any other top-level field is non-spec and should live in metadata.
 */
export const SPEC_FIELDS = new Set([
	"name",
	"description",
	"license",
	"compatibility",
	"allowed-tools",
	"metadata",
]);

/**
 * Resolve a field value from frontmatter, checking both top-level and metadata.
 * Prefers top-level for backward compatibility.
 */
export function resolveField(fm: Record<string, unknown>, field: string): unknown {
	if (fm[field] !== undefined) {
		return fm[field];
	}
	if (fm.metadata && typeof fm.metadata === "object") {
		const meta = fm.metadata as Record<string, unknown>;
		return meta[field];
	}
	return undefined;
}

/**
 * Resolve a string field from frontmatter, checking both top-level and metadata.
 */
export function resolveStringField(fm: Record<string, unknown>, field: string): string | undefined {
	const value = resolveField(fm, field);
	return typeof value === "string" ? value : undefined;
}

/**
 * Check if a field is in a non-spec top-level position.
 * Returns true if the field exists at top-level and is not one of the 6 spec fields.
 */
export function isNonSpecTopLevel(fm: Record<string, unknown>, field: string): boolean {
	return fm[field] !== undefined && !SPEC_FIELDS.has(field);
}

import type { FixResult } from "../types.ts";

const TRAILING_NEWLINES_RE = /\n+$/;

/**
 * Normalize formatting:
 * - Trim trailing whitespace from each line
 * - Ensure file ends with exactly one newline
 */
export function fixFormat(content: string): {
	content: string;
	fixes: FixResult[];
} | null {
	const fixes: FixResult[] = [];
	let result = content;

	// Trim trailing whitespace from each line
	const trimmed = result
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
	if (trimmed !== result) {
		result = trimmed;
		fixes.push({
			fixer: "format",
			description: "Trimmed trailing whitespace",
		});
	}

	// Ensure file ends with exactly one newline
	if (!result.endsWith("\n")) {
		result = `${result}\n`;
		fixes.push({
			fixer: "format",
			description: "Added trailing newline",
		});
	} else if (result.endsWith("\n\n")) {
		result = `${result.replace(TRAILING_NEWLINES_RE, "")}\n`;
		fixes.push({
			fixer: "format",
			description: "Removed extra trailing newlines",
		});
	}

	if (fixes.length === 0) {
		return null;
	}

	return { content: result, fixes };
}

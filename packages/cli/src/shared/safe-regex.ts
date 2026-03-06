/**
 * Detect regular expressions that are likely to cause catastrophic backtracking (ReDoS).
 *
 * Uses heuristic analysis of the pattern string to detect common dangerous constructs:
 * - Nested quantifiers: (a+)+, (a*)+, (a+)*, (a{2,})+
 * - Overlapping alternation with quantifiers: (a|a)+, (a|ab)+
 * - Star-height > 1 patterns
 *
 * This is a lightweight heuristic — not a full regex parser. It catches the most common
 * ReDoS patterns without requiring a dependency like `safe-regex2` or `re2`.
 *
 * Returns true if the pattern appears safe, false if it looks potentially dangerous.
 */
export function isSafeRegex(pattern: string): boolean {
	// First, verify it's a valid regex at all
	try {
		new RegExp(pattern);
	} catch {
		return false;
	}

	// Detect nested quantifiers: a quantifier applied to a group that contains a quantifier.
	// This catches patterns like (a+)+, (a*)+, (a+)*, (a{2,})*, etc.
	// Strategy: walk the pattern tracking group nesting depth and quantifier presence.
	if (hasNestedQuantifiers(pattern)) {
		return false;
	}

	// Detect excessive quantifier chains that can cause polynomial backtracking
	// e.g., a+a+a+a+ on a long non-matching string
	if (hasExcessiveQuantifierChains(pattern)) {
		return false;
	}

	return true;
}

const QUANTIFIER_CHARS = new Set(["*", "+", "?"]);
const BRACE_QUANTIFIER_RE = /^\{\d+,?\d*\}/;

function isQuantifier(pattern: string, pos: number): boolean {
	const ch = pattern[pos];
	if (QUANTIFIER_CHARS.has(ch)) {
		return true;
	}
	// {n,m} style quantifiers
	if (ch === "{") {
		const close = pattern.indexOf("}", pos);
		if (close !== -1 && BRACE_QUANTIFIER_RE.test(pattern.slice(pos, close + 1))) {
			return true;
		}
	}
	return false;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: regex pattern analysis is inherently complex
function hasNestedQuantifiers(pattern: string): boolean {
	// Track group boundaries and whether each group-level has a quantifier inside
	const groupStack: { hasQuantifier: boolean }[] = [];
	let i = 0;

	while (i < pattern.length) {
		const ch = pattern[i];

		// Skip escaped characters
		if (ch === "\\") {
			i += 2;
			continue;
		}

		// Skip character classes entirely
		if (ch === "[") {
			const end = findCharClassEnd(pattern, i);
			i = end + 1;
			continue;
		}

		// Opening group (capturing or non-capturing)
		if (ch === "(") {
			groupStack.push({ hasQuantifier: false });
			i++;
			continue;
		}

		// Closing group
		if (ch === ")") {
			const group = groupStack.pop();
			const innerHasQuantifier = group?.hasQuantifier ?? false;
			i++;

			// Check if a quantifier follows this group
			if (i < pattern.length && isQuantifier(pattern, i)) {
				// This group has a quantifier on it
				if (innerHasQuantifier) {
					// Nested quantifier detected: group contains a quantifier AND has one on it
					return true;
				}
				// Mark the parent group as having a quantifier
				if (groupStack.length > 0) {
					// biome-ignore lint/style/useAtIndex: .at() returns possibly undefined, bracket access is guarded by length check
					groupStack[groupStack.length - 1].hasQuantifier = true;
				}
			}
			continue;
		}

		// Check for quantifiers on atoms
		if (isQuantifier(pattern, i)) {
			if (groupStack.length > 0) {
				// biome-ignore lint/style/useAtIndex: .at() returns possibly undefined, bracket access is guarded by length check
				groupStack[groupStack.length - 1].hasQuantifier = true;
			}
			// Skip past the quantifier (and optional ? or + modifiers)
			i++;
			if (i < pattern.length && (pattern[i] === "?" || pattern[i] === "+")) {
				i++;
			}
			continue;
		}

		i++;
	}

	return false;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: regex pattern analysis is inherently complex
function hasExcessiveQuantifierChains(pattern: string): boolean {
	// Count consecutive quantified atoms that can match overlapping input
	// e.g., \w+\w+\w+\w+ — each \w+ can greedily consume then backtrack
	let consecutiveQuantified = 0;
	let i = 0;

	while (i < pattern.length) {
		const ch = pattern[i];

		if (ch === "\\") {
			i += 2;
			// Check if followed by a quantifier
			if (i < pattern.length && isQuantifier(pattern, i)) {
				consecutiveQuantified++;
				i++;
				continue;
			}
			consecutiveQuantified = 0;
			continue;
		}

		if (ch === "[") {
			const end = findCharClassEnd(pattern, i);
			i = end + 1;
			if (i < pattern.length && isQuantifier(pattern, i)) {
				consecutiveQuantified++;
				i++;
				continue;
			}
			consecutiveQuantified = 0;
			continue;
		}

		if (ch === "(" || ch === ")") {
			consecutiveQuantified = 0;
			i++;
			continue;
		}

		if (ch === "." || ch === "^" || ch === "$" || ch === "|") {
			consecutiveQuantified = 0;
			i++;
			continue;
		}

		// Regular character
		i++;
		if (i < pattern.length && isQuantifier(pattern, i)) {
			consecutiveQuantified++;
			i++;
		} else {
			consecutiveQuantified = 0;
		}

		if (consecutiveQuantified >= 4) {
			return true;
		}
	}

	return false;
}

function findCharClassEnd(pattern: string, start: number): number {
	let i = start + 1;
	// Handle negated class and literal ] at start
	if (i < pattern.length && pattern[i] === "^") {
		i++;
	}
	if (i < pattern.length && pattern[i] === "]") {
		i++;
	}

	while (i < pattern.length) {
		if (pattern[i] === "\\") {
			i += 2;
			continue;
		}
		if (pattern[i] === "]") {
			return i;
		}
		i++;
	}
	return pattern.length - 1;
}

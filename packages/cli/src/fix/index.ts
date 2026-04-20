import { stat } from "node:fs/promises";
import matter from "gray-matter";
import { discoverSkillFiles } from "../shared/discovery.ts";
import { readSkillFile, writeSkillFile } from "../skill-io.ts";
import { fixCompatibility } from "./fixers/compatibility.ts";
import { fixFormat } from "./fixers/format.ts";
import { fixFrontmatter } from "./fixers/frontmatter.ts";
import type { FileFixResult, FixOptions, FixReport, FixResult } from "./types.ts";

/**
 * Extract frontmatter from content string (helper for re-parsing after modifications).
 */
function extractFrontmatter(content: string): Record<string, unknown> {
	try {
		return matter(content).data;
	} catch {
		return {};
	}
}

/**
 * Run all fixers on discovered skill files.
 *
 * 1. Discover SKILL.md files
 * 2. For each file, run fixers in order: frontmatter, compatibility, format
 * 3. If --write, apply changes to disk
 * 4. Return a FixReport
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator function
export async function runFix(paths: string[], options: FixOptions = {}): Promise<FixReport> {
	// Discover all skill files
	const allFiles: string[] = [];
	for (const p of paths) {
		try {
			const info = await stat(p);
			if (info.isDirectory()) {
				const discovered = await discoverSkillFiles(p);
				allFiles.push(...discovered);
			} else if (p.endsWith(".md")) {
				allFiles.push(p);
			}
		} catch {
			throw new Error(`Cannot access path: ${p}`);
		}
	}

	const results: FileFixResult[] = [];

	for (const filePath of allFiles) {
		const skillFile = await readSkillFile(filePath);
		let currentContent = skillFile.raw;
		const allFixes: FixResult[] = [];

		// 1. Frontmatter normalization
		const fmResult = await fixFrontmatter({
			...skillFile,
			raw: currentContent,
		});
		if (fmResult) {
			currentContent = fmResult.content;
			allFixes.push(...fmResult.fixes);
		}

		// 2. Compatibility migration (re-parse after frontmatter changes)
		const compatResult = fixCompatibility({
			...skillFile,
			raw: currentContent,
			frontmatter: fmResult
				? { ...skillFile.frontmatter, ...extractFrontmatter(currentContent) }
				: skillFile.frontmatter,
		});
		if (compatResult) {
			currentContent = compatResult.content;
			allFixes.push(...compatResult.fixes);
		}

		// 3. Format normalization
		const formatResult = fixFormat(currentContent);
		if (formatResult) {
			currentContent = formatResult.content;
			allFixes.push(...formatResult.fixes);
		}

		if (allFixes.length > 0) {
			// Write if requested
			if (options.write) {
				await writeSkillFile(filePath, currentContent);
			}
			results.push({
				file: filePath,
				applied: allFixes,
			});
		}
	}

	return {
		files: allFiles.length,
		results,
		totalFixes: results.reduce((sum, r) => sum + r.applied.length, 0),
		written: options.write ?? false,
		generatedAt: new Date().toISOString(),
	};
}

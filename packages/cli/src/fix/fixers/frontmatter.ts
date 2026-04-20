import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import type { SkillFile } from "../../skill-io.ts";
import type { FixResult } from "../types.ts";

function getExecFileAsync() {
	return promisify(execFile);
}

async function resolveGitValue(command: string, args: string[]): Promise<string | null> {
	try {
		const { stdout } = await getExecFileAsync()(command, args, { timeout: 5000 });
		const value = stdout.trim();
		return value.length > 0 ? value : null;
	} catch {
		return null;
	}
}

const SKILL_PREFIX_RE = /^SKILL-?/i;
const SKILL_SUFFIX_RE = /-?SKILL$/i;

/**
 * Derive a skill name from the file path.
 * e.g., "nextjs-SKILL.md" -> "nextjs", "SKILL.md" -> "skill"
 */
function deriveNameFromPath(filePath: string): string {
	const base = basename(filePath, ".md");
	const name = base.replace(SKILL_PREFIX_RE, "").replace(SKILL_SUFFIX_RE, "");
	return name.length > 0 ? name.toLowerCase() : basename(filePath, ".md").toLowerCase();
}

/**
 * Normalize frontmatter: ensure required fields (name, description) exist.
 * Populates missing fields from filename and git context.
 */
export async function fixFrontmatter(file: SkillFile): Promise<{
	content: string;
	fixes: FixResult[];
} | null> {
	const fm = { ...file.frontmatter };
	const fixes: FixResult[] = [];

	// Ensure name exists
	if (!fm.name || typeof fm.name !== "string" || fm.name.trim().length === 0) {
		fm.name = deriveNameFromPath(file.path);
		fixes.push({
			fixer: "frontmatter",
			description: `Added missing "name" field: "${fm.name}"`,
		});
	}

	// Ensure description exists
	if (!fm.description || typeof fm.description !== "string" || fm.description.trim().length === 0) {
		fm.description = `Agent skill for ${fm.name}`;
		fixes.push({
			fixer: "frontmatter",
			description: `Added missing "description" field`,
		});
	}

	// Populate author from git if missing
	if (!fm.author || typeof fm.author !== "string" || fm.author.trim().length === 0) {
		const author = await resolveGitValue("git", ["config", "user.name"]);
		if (author) {
			fm.author = author;
			fixes.push({
				fixer: "frontmatter",
				description: `Added missing "author" field from git: "${author}"`,
			});
		}
	}

	if (fixes.length === 0) {
		return null;
	}

	const content = matter.stringify(file.content, fm);
	return { content, fixes };
}

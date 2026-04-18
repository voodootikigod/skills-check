import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

export interface SkillFile {
	content: string;
	deprecatedMessage?: string;
	frontmatter: Record<string, unknown>;
	path: string;
	raw: string;
	status?: "active" | "deprecated" | "revoked";
}

export function resolveSkillLifecycle(frontmatter: Record<string, unknown>): Pick<
	SkillFile,
	"deprecatedMessage" | "status"
> {
	if (frontmatter.deprecated !== true) {
		return {};
	}

	return {
		status: "deprecated",
		...(typeof frontmatter.deprecatedMessage === "string"
			? { deprecatedMessage: frontmatter.deprecatedMessage }
			: {}),
	};
}

/**
 * Read a SKILL.md file and parse its frontmatter.
 */
export async function readSkillFile(filePath: string): Promise<SkillFile> {
	const raw = await readFile(filePath, "utf-8");
	const { data, content } = matter(raw);
	const lifecycle = resolveSkillLifecycle(data);

	return {
		path: filePath,
		frontmatter: data,
		content,
		raw,
		...lifecycle,
	};
}

/**
 * Write updated content to a SKILL.md file.
 */
export async function writeSkillFile(filePath: string, content: string): Promise<void> {
	await writeFile(filePath, content, "utf-8");
}

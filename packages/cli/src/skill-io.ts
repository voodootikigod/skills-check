import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";

export interface SkillFile {
	content: string;
	frontmatter: Record<string, unknown>;
	path: string;
	raw: string;
}

export async function readSkillFile(filePath: string): Promise<SkillFile> {
	const raw = await readFile(filePath, "utf-8");
	const { data, content } = matter(raw);

	return {
		path: filePath,
		frontmatter: data,
		content,
		raw,
	};
}

export async function writeSkillFile(filePath: string, content: string): Promise<void> {
	const tmpPath = join(dirname(filePath), `.${Date.now()}.tmp`);
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, filePath);
}

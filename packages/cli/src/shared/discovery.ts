import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Try to find a skill file in a directory.
 * Prefers SKILL.md (spec convention), falls back to skill.md.
 * Returns the full path if found, null otherwise.
 */
async function findSkillFile(dirPath: string): Promise<string | null> {
	// Prefer SKILL.md (spec convention)
	const uppercase = join(dirPath, "SKILL.md");
	try {
		await lstat(uppercase);
		return uppercase;
	} catch {
		// Try lowercase fallback
	}

	const lowercase = join(dirPath, "skill.md");
	try {
		await lstat(lowercase);
		return lowercase;
	} catch {
		return null;
	}
}

/**
 * Recursively discover SKILL.md (or skill.md) files in a directory.
 *
 * Walks the directory tree looking for skill files. When a directory
 * contains a SKILL.md or skill.md, that file is collected and the
 * directory is not recursed further. Results are returned sorted
 * alphabetically. Prefers SKILL.md over skill.md per the spec.
 */
export async function discoverSkillFiles(dir: string): Promise<string[]> {
	const files: string[] = [];

	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		throw new Error(`Cannot read directory: ${dir}`);
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		try {
			const info = await lstat(fullPath);
			if (info.isDirectory()) {
				const skillFile = await findSkillFile(fullPath);
				if (skillFile) {
					files.push(skillFile);
				} else {
					// No skill file here — recurse deeper
					const nested = await discoverSkillFiles(fullPath);
					files.push(...nested);
				}
			} else if (entry === "SKILL.md" || entry === "skill.md") {
				files.push(fullPath);
			}
		} catch {
			// skip inaccessible entries
		}
	}

	return files.sort();
}

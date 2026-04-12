import { execFile } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentExecution } from "../types.js";
import type { AgentHarness } from "./interface.js";

/**
 * List all files in a directory recursively.
 */
async function listFilesRecursive(dir: string): Promise<Set<string>> {
	const files = new Set<string>();

	async function walk(d: string) {
		let entries: string[];
		try {
			entries = await readdir(d);
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = join(d, entry);
			try {
				const info = await lstat(fullPath);
				if (info.isDirectory()) {
					await walk(fullPath);
				} else {
					files.add(fullPath);
				}
			} catch {
				// skip inaccessible
			}
		}
	}

	await walk(dir);
	return files;
}

const WHITESPACE_RE = /\s+/;

/**
 * Parse a command template string into an executable and argument template array.
 * The template is split on whitespace; `{prompt}` tokens in the args are replaced
 * at execution time with the actual prompt value — never shell-interpolated.
 */
export function parseCommandTemplate(template: string): { cmd: string; argTemplate: string[] } {
	const parts = template.split(WHITESPACE_RE).filter(Boolean);
	if (parts.length === 0) {
		throw new Error("Command template must not be empty");
	}
	return { cmd: parts[0], argTemplate: parts.slice(1) };
}

/**
 * Generic agent harness that executes commands without a shell.
 * Uses execFile() instead of exec() to prevent command injection from untrusted prompts.
 * The {prompt} placeholder is replaced in the argument array, never shell-interpolated.
 */
export class GenericHarness implements AgentHarness {
	readonly name = "generic";
	private readonly commandTemplate: string;

	constructor(commandTemplate?: string) {
		this.commandTemplate = commandTemplate ?? "echo {prompt}";
	}

	// biome-ignore lint/suspicious/useAwait: interface contract requires async
	async available(): Promise<boolean> {
		return true; // Shell is always available
	}

	async execute(
		prompt: string,
		options: { workDir: string; timeout: number; skills?: string[] }
	): Promise<AgentExecution> {
		const beforeFiles = await listFilesRecursive(options.workDir);
		const start = Date.now();

		const { cmd, argTemplate } = parseCommandTemplate(this.commandTemplate);
		const args = argTemplate.map((a) =>
			a === "{prompt}" ? prompt : a.replaceAll("{prompt}", prompt)
		);

		const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>(
			(resolve) => {
				execFile(
					cmd,
					args,
					{
						cwd: options.workDir,
						timeout: options.timeout * 1000,
						maxBuffer: 10 * 1024 * 1024,
						env: { ...process.env, SKILLS_CHECK_PROMPT: prompt },
					},
					(error, stdout, stderr) => {
						resolve({
							exitCode: error ? ((error as { code?: number }).code ?? 1) : 0,
							stdout: stdout ?? "",
							stderr: stderr ?? "",
						});
					}
				);
			}
		);

		const duration = Date.now() - start;
		const afterFiles = await listFilesRecursive(options.workDir);
		const filesCreated = [...afterFiles].filter((f) => !beforeFiles.has(f));

		return {
			exitCode: result.exitCode,
			transcript: result.stdout,
			filesCreated,
			duration,
		};
	}
}

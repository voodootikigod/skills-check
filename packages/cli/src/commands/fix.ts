import { runFix } from "../fix/index.js";
import { formatFixJson } from "../fix/reporters/json.js";
import { formatFixTerminal } from "../fix/reporters/terminal.js";
import type { FixOptions } from "../fix/types.js";
import { formatAndOutput } from "../shared/index.js";

interface FixCommandOptions {
	format?: "terminal" | "json";
	write?: boolean;
}

export async function fixCommand(dir: string, options: FixCommandOptions): Promise<number> {
	const fixOptions: FixOptions = {
		write: options.write,
		format: options.format,
	};

	const report = await runFix([dir], fixOptions);

	await formatAndOutput(
		report,
		{ format: options.format },
		{
			terminal: formatFixTerminal,
			json: formatFixJson,
		}
	);

	return 0;
}

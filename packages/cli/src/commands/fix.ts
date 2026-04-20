import { runFix } from "../fix/index.ts";
import { formatFixJson } from "../fix/reporters/json.ts";
import { formatFixTerminal } from "../fix/reporters/terminal.ts";
import type { FixOptions } from "../fix/types.ts";
import { formatAndOutput } from "../shared/index.ts";

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

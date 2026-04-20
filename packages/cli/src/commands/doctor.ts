import { runDoctor } from "../doctor/index.ts";
import { formatDoctorJson } from "../doctor/reporters/json.ts";
import { formatDoctorTerminal } from "../doctor/reporters/terminal.ts";
import type { DoctorOptions } from "../doctor/types.ts";
import { formatAndOutput } from "../shared/index.ts";

interface DoctorCommandOptions {
	ci?: boolean;
	format?: "terminal" | "json";
}

export async function doctorCommand(options: DoctorCommandOptions): Promise<number> {
	const doctorOptions: DoctorOptions = {
		ci: options.ci,
		format: options.format,
	};

	const report = await runDoctor(process.cwd(), doctorOptions);

	await formatAndOutput(
		report,
		{ format: options.format },
		{
			terminal: formatDoctorTerminal,
			json: formatDoctorJson,
		}
	);

	// In CI mode, exit non-zero on errors
	if (options.ci && report.errors > 0) {
		return 1;
	}

	return 0;
}

import { runDoctor } from "../doctor/index.js";
import { formatDoctorJson } from "../doctor/reporters/json.js";
import { formatDoctorTerminal } from "../doctor/reporters/terminal.js";
import type { DoctorOptions } from "../doctor/types.js";
import { formatAndOutput } from "../shared/index.js";

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

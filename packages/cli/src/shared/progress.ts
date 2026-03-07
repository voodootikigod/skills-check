import chalk from "chalk";

/**
 * Lightweight progress indicator for long-running commands.
 * Outputs to stderr so it doesn't interfere with report output on stdout.
 * Only emits when verbose mode is enabled.
 */
export interface Progress {
	/** Report step completion */
	done(message?: string): void;
	/** Report starting a step (e.g., "Scanning files...") */
	step(message: string): void;
	/** Report progress within a step (e.g., "3/10 files checked") */
	update(current: number, total: number, label?: string): void;
}

/**
 * Create a progress reporter. Returns a no-op if verbose is false.
 */
export function createProgress(verbose?: boolean): Progress {
	if (!verbose) {
		// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-ops
		return { step() {}, update() {}, done() {} };
	}

	return {
		step(message: string) {
			console.error(chalk.dim(`  → ${message}`));
		},
		update(current: number, total: number, label?: string) {
			const pct = total > 0 ? Math.round((current / total) * 100) : 0;
			const suffix = label ? ` ${label}` : "";
			console.error(chalk.dim(`  ${current}/${total} (${pct}%)${suffix}`));
		},
		done(message?: string) {
			if (message) {
				console.error(chalk.dim(`  ✓ ${message}`));
			}
		},
	};
}

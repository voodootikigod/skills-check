import type { SkillTelemetryEvent as _SkillTelemetryEvent } from "@skills-check/schema";

export type SkillTelemetryEvent = _SkillTelemetryEvent;

export interface TelemetryReaderOptions {
	since?: Date;
	until?: Date;
}

export interface TelemetryReader {
	close(): Promise<void>;
	read(options?: TelemetryReaderOptions): Promise<SkillTelemetryEvent[]>;
}

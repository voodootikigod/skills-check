import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillTelemetryEvent } from "@skills-check/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeUsage } from "../analyzer.ts";
import { JSONLReader } from "./jsonl.ts";
import { SQLiteReader } from "./sqlite.ts";

const SQLITE_ERROR =
	"SQLite reader requires Node.js 22+ with built-in sqlite module. Use a JSONL telemetry store instead, or upgrade Node.js.";

function makeEvent(overrides?: Partial<SkillTelemetryEvent>): SkillTelemetryEvent {
	return {
		schemaVersion: 1,
		timestamp: "2026-03-08T08:00:00.000Z",
		detection: "watermark",
		confidence: 1,
		skillId: "react-patterns",
		version: "19.1.0",
		registry: "skills.sh",
		requestId: "req-1",
		model: "claude-sonnet-4-6",
		skillTokens: 1200,
		totalPromptTokens: 4500,
		team: "platform",
		project: "skills-check",
		user: "alice",
		...overrides,
	};
}

function sortEvents(events: SkillTelemetryEvent[]): SkillTelemetryEvent[] {
	return [...events].sort((left, right) => {
		const timestampOrder = right.timestamp.localeCompare(left.timestamp);
		if (timestampOrder !== 0) {
			return timestampOrder;
		}

		const requestOrder = (left.requestId ?? "").localeCompare(right.requestId ?? "");
		if (requestOrder !== 0) {
			return requestOrder;
		}

		return left.detection.localeCompare(right.detection);
	});
}

describe("SQLiteReader", () => {
	let tempDir: string;
	let dbPath: string;
	let jsonlPath: string;
	let events: SkillTelemetryEvent[];

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-check-sqlite-reader-"));
		dbPath = join(tempDir, "telemetry.db");
		jsonlPath = join(tempDir, "telemetry.jsonl");

		events = [
			makeEvent({
				timestamp: "2026-02-01T00:00:00.000Z",
				requestId: "req-0",
				skillTokens: 900,
				totalPromptTokens: 3200,
				user: "zoe",
			}),
			makeEvent({
				timestamp: "2026-03-08T08:00:00.000Z",
				requestId: "req-1",
				detection: "watermark",
				confidence: 1,
				skillTokens: 1200,
			}),
			makeEvent({
				timestamp: "2026-03-08T08:00:00.000Z",
				requestId: "req-1",
				detection: "content_hash",
				confidence: 0.6,
				skillTokens: 1100,
			}),
			makeEvent({
				timestamp: "2026-03-09T12:30:00.000Z",
				requestId: "req-2",
				skillId: "vue-patterns",
				version: "3.5.0",
				model: "gpt-4o",
				skillTokens: 1500,
				team: "frontend",
				user: "bob",
			}),
			makeEvent({
				timestamp: "2026-03-10T15:45:00.000Z",
				requestId: "req-3",
				skillId: "react-patterns",
				version: "19.2.0",
				detection: "prefix_hash",
				confidence: 0.8,
				skillTokens: 1800,
				totalPromptTokens: 5100,
				user: "carol",
			}),
		];

		// biome-ignore lint/correctness/noUnresolvedImports: Node 22 built-in sqlite module is available at runtime
		const { DatabaseSync } = await import("node:sqlite");
		const db = new DatabaseSync(dbPath);
		db.exec(
			`CREATE TABLE skill_events (
				timestamp TEXT NOT NULL,
				detection TEXT NOT NULL,
				confidence REAL NOT NULL,
				skill_id TEXT NOT NULL,
				skill_version TEXT NOT NULL,
				registry TEXT,
				request_id TEXT,
				model TEXT,
				skill_tokens INTEGER,
				total_prompt_tokens INTEGER,
				team TEXT,
				project TEXT,
				user TEXT
			)`
		);

		const insert = db.prepare(
			`INSERT INTO skill_events (
				timestamp,
				detection,
				confidence,
				skill_id,
				skill_version,
				registry,
				request_id,
				model,
				skill_tokens,
				total_prompt_tokens,
				team,
				project,
				user
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);

		for (const event of events) {
			insert.run(
				event.timestamp,
				event.detection,
				event.confidence,
				event.skillId,
				event.version,
				event.registry ?? null,
				event.requestId ?? null,
				event.model ?? null,
				event.skillTokens ?? null,
				event.totalPromptTokens ?? null,
				event.team ?? null,
				event.project ?? null,
				event.user ?? null
			);
		}

		db.close();

		await writeFile(jsonlPath, events.map((event) => JSON.stringify(event)).join("\n"), "utf-8");
	});

	afterAll(async () => {
		await rm(tempDir, { force: true, recursive: true });
	});

	it("reads telemetry events from a real SQLite database", async () => {
		const reader = new SQLiteReader(dbPath);
		const result = await reader.read();
		await reader.close();

		expect(result).toHaveLength(events.length);
		expect(result).toEqual(sortEvents(events));
	});

	it("cross-validates SQLite output against the JSONL reader for the same dataset", async () => {
		const sqliteReader = new SQLiteReader(dbPath);
		const jsonlReader = new JSONLReader(jsonlPath);

		const [sqliteEvents, jsonlEvents] = await Promise.all([
			sqliteReader.read(),
			jsonlReader.read(),
		]);

		await Promise.all([sqliteReader.close(), jsonlReader.close()]);

		expect(sortEvents(sqliteEvents)).toEqual(sortEvents(jsonlEvents));
	});

	it("supports date range filtering against the real database", async () => {
		const reader = new SQLiteReader(dbPath);
		const result = await reader.read({
			since: new Date("2026-03-08T00:00:00.000Z"),
			until: new Date("2026-03-09T23:59:59.999Z"),
		});
		await reader.close();

		expect(result).toEqual(
			sortEvents(
				events.filter(
					(event) =>
						event.timestamp >= "2026-03-08T00:00:00.000Z" &&
						event.timestamp <= "2026-03-09T23:59:59.999Z"
				)
			)
		);
	});

	it("preserves duplicate detections so downstream usage analysis can deduplicate them", async () => {
		const reader = new SQLiteReader(dbPath);
		const sqliteEvents = await reader.read();
		await reader.close();

		const usageReport = analyzeUsage(sqliteEvents);
		const reactSkill = usageReport.skills.find((skill) => skill.name === "react-patterns");

		expect(sqliteEvents.filter((event) => event.requestId === "req-1")).toHaveLength(2);
		expect(reactSkill).toMatchObject({
			hasVersionDrift: true,
			totalCalls: 3,
			versions: ["19.1.0", "19.2.0"],
		});
		expect(usageReport.totalCalls).toBe(4);
	});

	it("fails with a helpful error for missing or corrupt SQLite files", async () => {
		const missingReader = new SQLiteReader(join(tempDir, "missing.db"));
		const corruptPath = join(tempDir, "corrupt.db");
		await writeFile(corruptPath, "not a sqlite database", "utf-8");
		const corruptReader = new SQLiteReader(corruptPath);

		await expect(missingReader.read()).rejects.toThrow(SQLITE_ERROR);
		await expect(corruptReader.read()).rejects.toThrow(SQLITE_ERROR);

		await Promise.all([missingReader.close(), corruptReader.close()]);
	});
});

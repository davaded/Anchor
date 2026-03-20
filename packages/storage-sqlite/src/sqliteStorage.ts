import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { AnchorEventSchema, ArtifactMetadataSchema, ProjectionSnapshotSchema, replayEvents } from "@anchor/core";
import type { AnchorEvent, ArtifactMetadata, ProjectionSnapshot, TaskProjection } from "@anchor/core";

type JsonRow = { snapshot_json: string };
type EventRow = {
  event_id: string;
  task_id: string;
  goal_id: string;
  round_id: string | null;
  type: string;
  occurred_at: string;
  payload_json: string;
};

export class SqliteStorage {
  private readonly filePath: string;
  private readonly ready: Promise<void>;
  private SQL!: SqlJsStatic;
  private db!: Database;

  public constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.ready = this.initialize();
  }

  public async append(events: AnchorEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.ready;
    const parsed = events.map((event) => AnchorEventSchema.parse(event));
    const taskId = parsed[0].task_id;

    this.db.run("BEGIN");
    try {
      const insert = this.db.prepare(`
        INSERT INTO events (event_id, task_id, goal_id, round_id, type, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const event of parsed) {
        insert.run([
          event.event_id,
          event.task_id,
          event.goal_id,
          event.round_id ?? null,
          event.type,
          event.occurred_at,
          JSON.stringify(event.payload)
        ]);
      }
      insert.free();

      const snapshot = this.buildSnapshot(taskId);
      this.persistSnapshot(snapshot);
      this.db.run("COMMIT");
      this.flush();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  public async listEvents(taskId: string): Promise<AnchorEvent[]> {
    await this.ready;
    return this.selectEvents(taskId);
  }

  public async getSnapshot(taskId: string): Promise<ProjectionSnapshot | null> {
    await this.ready;
    const taskRows = this.queryJson(`SELECT snapshot_json FROM tasks WHERE task_id = ?`, [taskId]);
    if (taskRows.length === 0) {
      return null;
    }

    return ProjectionSnapshotSchema.parse({
      task: JSON.parse(taskRows[0].snapshot_json),
      rounds: this.queryJson(`SELECT snapshot_json FROM rounds WHERE task_id = ? ORDER BY ordinal`, [taskId]).map((row) => JSON.parse(row.snapshot_json)),
      failure_patterns: this.queryJson(`SELECT snapshot_json FROM failure_patterns WHERE task_id = ? ORDER BY fingerprint_key`, [taskId]).map((row) => JSON.parse(row.snapshot_json)),
      validated_facts: this.queryJson(`SELECT snapshot_json FROM validated_facts WHERE task_id = ? ORDER BY round_id, fingerprint_key`, [taskId]).map((row) => JSON.parse(row.snapshot_json)),
      strategy_stats: this.queryJson(`SELECT snapshot_json FROM strategy_stats WHERE task_id = ? ORDER BY strategy`, [taskId]).map((row) => JSON.parse(row.snapshot_json)),
      artifacts: this.queryJson(`SELECT snapshot_json FROM artifacts WHERE task_id = ? ORDER BY created_at, artifact_id`, [taskId]).map((row) => JSON.parse(row.snapshot_json))
    });
  }

  public async listTasks(): Promise<TaskProjection[]> {
    await this.ready;
    return this.queryJson(`SELECT snapshot_json FROM tasks ORDER BY updated_at DESC`).map((row) => JSON.parse(row.snapshot_json));
  }

  public async rebuild(taskId: string): Promise<ProjectionSnapshot> {
    await this.ready;
    const snapshot = this.buildSnapshot(taskId);
    this.persistSnapshot(snapshot);
    this.flush();
    return snapshot;
  }

  public async recordArtifact(metadata: ArtifactMetadata): Promise<void> {
    await this.ready;
    const parsed = ArtifactMetadataSchema.parse(metadata);
    this.db.run(`
      INSERT OR REPLACE INTO artifacts (artifact_id, task_id, round_id, event_id, type, path, created_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parsed.artifact_id,
      parsed.task_id,
      parsed.round_id ?? null,
      parsed.event_id,
      parsed.type,
      parsed.path,
      parsed.created_at,
      JSON.stringify(parsed)
    ]);
    this.flush();
  }

  public async getArtifactMetadata(artifactId: string): Promise<ArtifactMetadata | null> {
    await this.ready;
    const rows = this.queryJson(`SELECT snapshot_json FROM artifacts WHERE artifact_id = ?`, [artifactId]);
    return rows[0] ? ArtifactMetadataSchema.parse(JSON.parse(rows[0].snapshot_json)) : null;
  }

  private async initialize() {
    this.SQL = await initSqlJs();
    if (fs.existsSync(this.filePath)) {
      const buffer = fs.readFileSync(this.filePath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        goal_id TEXT NOT NULL,
        round_id TEXT,
        type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        runtime_state TEXT NOT NULL,
        terminal_reason TEXT,
        stop_trigger TEXT,
        active_round_id TEXT,
        backend_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rounds (
        task_id TEXT NOT NULL,
        round_id TEXT NOT NULL,
        ordinal INTEGER,
        fingerprint_key TEXT,
        strategy TEXT,
        created_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        PRIMARY KEY (task_id, round_id)
      );
      CREATE TABLE IF NOT EXISTS failure_patterns (
        task_id TEXT NOT NULL,
        round_id TEXT,
        ordinal INTEGER,
        fingerprint_key TEXT NOT NULL,
        strategy TEXT,
        created_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        PRIMARY KEY (task_id, fingerprint_key)
      );
      CREATE TABLE IF NOT EXISTS validated_facts (
        task_id TEXT NOT NULL,
        round_id TEXT,
        ordinal INTEGER,
        fingerprint_key TEXT NOT NULL,
        strategy TEXT,
        created_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        PRIMARY KEY (task_id, fingerprint_key)
      );
      CREATE TABLE IF NOT EXISTS strategy_stats (
        task_id TEXT NOT NULL,
        round_id TEXT,
        ordinal INTEGER,
        fingerprint_key TEXT NOT NULL,
        strategy TEXT,
        created_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        PRIMARY KEY (task_id, fingerprint_key)
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        artifact_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        round_id TEXT,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );
    `);
    this.flush();
  }

  private flush() {
    const data = this.db.export();
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  private queryJson(query: string, params: Array<string | null> = []): JsonRow[] {
    const statement = this.db.prepare(query);
    statement.bind(params);
    const rows: JsonRow[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as { snapshot_json?: unknown };
      rows.push({ snapshot_json: String(row.snapshot_json ?? "") });
    }
    statement.free();
    return rows;
  }

  private selectEvents(taskId: string): AnchorEvent[] {
    const statement = this.db.prepare(
      `SELECT event_id, task_id, goal_id, round_id, type, occurred_at, payload_json FROM events WHERE task_id = ? ORDER BY occurred_at, event_id`
    );
    statement.bind([taskId]);
    const events: AnchorEvent[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      events.push(
        AnchorEventSchema.parse({
          event_id: String(row.event_id),
          task_id: String(row.task_id),
          goal_id: String(row.goal_id),
          round_id: row.round_id ? String(row.round_id) : undefined,
          type: String(row.type),
          occurred_at: String(row.occurred_at),
          payload: JSON.parse(String(row.payload_json))
        })
      );
    }
    statement.free();
    return events;
  }

  private buildSnapshot(taskId: string): ProjectionSnapshot {
    const snapshot = replayEvents(this.selectEvents(taskId));
    snapshot.artifacts = this.queryJson(`SELECT snapshot_json FROM artifacts WHERE task_id = ? ORDER BY created_at, artifact_id`, [taskId]).map((row: JsonRow) => JSON.parse(row.snapshot_json));
    return ProjectionSnapshotSchema.parse(snapshot);
  }

  private persistSnapshot(snapshot: ProjectionSnapshot) {
    this.db.run(
      `
      INSERT OR REPLACE INTO tasks (task_id, goal_id, runtime_state, terminal_reason, stop_trigger, active_round_id, backend_id, created_at, updated_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        snapshot.task.task_id,
        snapshot.task.goal.goal_id,
        snapshot.task.runtime_state,
        snapshot.task.terminal_reason ?? null,
        snapshot.task.stop_trigger ?? null,
        snapshot.task.active_round_id ?? null,
        snapshot.task.backend_id,
        snapshot.task.created_at,
        snapshot.task.updated_at,
        JSON.stringify(snapshot.task)
      ]
    );

    this.replaceRows("rounds", snapshot.task.task_id, snapshot.rounds, (item: ProjectionSnapshot["rounds"][number]) => [
      item.task_id,
      item.round_id,
      item.ordinal,
      null,
      item.strategy,
      item.created_at,
      JSON.stringify(item)
    ]);

    this.replaceRows("failure_patterns", snapshot.task.task_id, snapshot.failure_patterns, (item: ProjectionSnapshot["failure_patterns"][number]) => [
      item.task_id,
      item.last_seen_round,
      null,
      item.fingerprint_key,
      null,
      item.last_seen_round,
      JSON.stringify(item)
    ]);

    this.replaceRows("validated_facts", snapshot.task.task_id, snapshot.validated_facts, (item: ProjectionSnapshot["validated_facts"][number]) => [
      item.task_id,
      item.round_id,
      null,
      item.id,
      null,
      item.round_id,
      JSON.stringify(item)
    ]);

    this.replaceRows("strategy_stats", snapshot.task.task_id, snapshot.strategy_stats, (item: ProjectionSnapshot["strategy_stats"][number]) => [
      item.task_id,
      item.last_used_round ?? null,
      null,
      item.strategy,
      item.strategy,
      item.last_used_round ?? "",
      JSON.stringify(item)
    ]);
  }

  private replaceRows(
    table: "rounds" | "failure_patterns" | "validated_facts" | "strategy_stats",
    taskId: string,
    rows: unknown[],
    mapRow: (row: any) => [string, string | null, number | null, string | null, string | null, string, string]
  ) {
    this.db.run(`DELETE FROM ${table} WHERE task_id = ?`, [taskId]);
    const insert = this.db.prepare(`
      INSERT INTO ${table} (task_id, round_id, ordinal, fingerprint_key, strategy, created_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) {
      insert.run(mapRow(row));
    }
    insert.free();
  }
}

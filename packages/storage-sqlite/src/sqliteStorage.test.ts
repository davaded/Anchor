import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AnchorRuntimeEngine } from "@anchor/core";
import { SqliteStorage } from "./sqliteStorage";

describe("SqliteStorage", () => {
  it("persists and rebuilds task projection from events", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-storage-"));
    const storage = new SqliteStorage(path.join(dir, "anchor.db"));
    const goal = AnchorRuntimeEngine.materializeGoal({ goal: "Ship a change" });
    const taskId = goal.goal_id.replace(/^goal_/, "task_");

    await storage.append([
      {
        event_id: "event_01JABCDEFGHJKMNPQRSTVWXYZ1",
        task_id: taskId,
        goal_id: goal.goal_id,
        occurred_at: new Date().toISOString(),
        type: "goal_started",
        payload: {
          goal,
          backend_id: "codex"
        }
      }
    ]);

    const snapshot = await storage.getSnapshot(taskId);
    expect(snapshot?.task.task_id).toBe(taskId);

    const rebuilt = await storage.rebuild(taskId);
    expect(rebuilt.task.task_id).toBe(taskId);
    expect((await storage.listEvents(taskId)).length).toBe(1);
  });
});

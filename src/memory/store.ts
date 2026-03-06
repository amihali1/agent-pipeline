import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { MemoryRecord } from "../types";

const DB_PATH = path.join(process.cwd(), "memory.db");

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath = DB_PATH) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id          TEXT PRIMARY KEY,
        agent_name  TEXT NOT NULL,
        input_hash  TEXT NOT NULL,
        task        TEXT NOT NULL,
        output      TEXT NOT NULL,
        reasoning   TEXT NOT NULL,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent ON memories(agent_name);
      CREATE INDEX IF NOT EXISTS idx_hash  ON memories(input_hash);
    `);
  }

  save(agentName: string, task: string, output: string, reasoning: string): void {
    const id = crypto.randomUUID();
    const inputHash = crypto
      .createHash("sha256")
      .update(agentName + task)
      .digest("hex");

    this.db
      .prepare(
        `INSERT INTO memories (id, agent_name, input_hash, task, output, reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, agentName, inputHash, task, output, reasoning, new Date().toISOString());
  }

  /** Returns the latest cached output for each agent that has run this exact task */
  getCachedResults(task: string, agentNames: string[]): Map<string, MemoryRecord> {
    const results = new Map<string, MemoryRecord>();
    for (const name of agentNames) {
      const hash = crypto
        .createHash("sha256")
        .update(name + task)
        .digest("hex");
      const row = this.db
        .prepare(`SELECT * FROM memories WHERE input_hash = ? ORDER BY created_at DESC LIMIT 1`)
        .get(hash) as MemoryRecord | undefined;
      if (row) results.set(name, row);
    }
    return results;
  }

  /** Returns exact match first, falls back to recent memories for this agent */
  recall(agentName: string, task: string, limit = 3): MemoryRecord[] {
    const inputHash = crypto
      .createHash("sha256")
      .update(agentName + task)
      .digest("hex");

    const exact = this.db
      .prepare(
        `SELECT * FROM memories WHERE input_hash = ? ORDER BY created_at DESC LIMIT 1`
      )
      .all(inputHash) as MemoryRecord[];

    if (exact.length > 0) return exact;

    return this.db
      .prepare(
        `SELECT * FROM memories WHERE agent_name = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(agentName, limit) as MemoryRecord[];
  }
}

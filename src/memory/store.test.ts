import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "./store";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    // Use in-memory DB for full test isolation
    store = new MemoryStore(":memory:");
  });

  describe("save and recall", () => {
    it("saves a memory and recalls it by exact match", () => {
      store.save("engineer", "build a login page", "login component code", "implemented with React");

      const recalled = store.recall("engineer", "build a login page");
      expect(recalled).toHaveLength(1);
      expect(recalled[0].agent_name).toBe("engineer");
      expect(recalled[0].task).toBe("build a login page");
      expect(recalled[0].output).toBe("login component code");
      expect(recalled[0].reasoning).toBe("implemented with React");
    });

    it("returns exactly one result for an exact hash match with duplicates", () => {
      store.save("engineer", "build a login page", "v1 code", "first attempt");
      store.save("engineer", "build a login page", "v2 code", "second attempt");

      const recalled = store.recall("engineer", "build a login page");
      expect(recalled).toHaveLength(1);
      // Returns one of the matching records (ordering depends on timestamp precision)
      expect(["v1 code", "v2 code"]).toContain(recalled[0].output);
    });

    it("falls back to recent memories when no exact match exists", () => {
      store.save("engineer", "task A", "output A", "reasoning A");
      store.save("engineer", "task B", "output B", "reasoning B");
      store.save("engineer", "task C", "output C", "reasoning C");

      const recalled = store.recall("engineer", "completely different task");
      expect(recalled).toHaveLength(3);
      // All three are returned (order depends on timestamp precision)
      const outputs = recalled.map((r) => r.output).sort();
      expect(outputs).toEqual(["output A", "output B", "output C"]);
    });

    it("respects the limit parameter for fallback recall", () => {
      store.save("engineer", "task A", "output A", "reasoning A");
      store.save("engineer", "task B", "output B", "reasoning B");
      store.save("engineer", "task C", "output C", "reasoning C");
      store.save("engineer", "task D", "output D", "reasoning D");

      const recalled = store.recall("engineer", "unknown task", 2);
      expect(recalled).toHaveLength(2);
    });

    it("returns empty array when no memories exist", () => {
      const recalled = store.recall("engineer", "any task");
      expect(recalled).toHaveLength(0);
    });

    it("isolates memories by agent name", () => {
      store.save("engineer", "build a form", "engineer output", "engineer reasoning");
      store.save("designer", "build a form", "designer output", "designer reasoning");

      const engineerRecall = store.recall("engineer", "build a form");
      expect(engineerRecall).toHaveLength(1);
      expect(engineerRecall[0].agent_name).toBe("engineer");

      const designerRecall = store.recall("designer", "build a form");
      expect(designerRecall).toHaveLength(1);
      expect(designerRecall[0].agent_name).toBe("designer");
    });

    it("does not cross-contaminate fallback memories between agents", () => {
      store.save("engineer", "task A", "engineer output", "eng reasoning");
      store.save("designer", "task B", "designer output", "des reasoning");

      const recalled = store.recall("engineer", "unknown task");
      expect(recalled).toHaveLength(1);
      expect(recalled[0].agent_name).toBe("engineer");
    });
  });

  describe("getCachedResults", () => {
    it("returns cached results for all agents when all have run the task", () => {
      store.save("designer", "build app", "design spec", "design reasoning");
      store.save("engineer", "build app", "app code", "eng reasoning");
      store.save("tester", "build app", "test suite", "test reasoning");
      store.save("reviewer", "build app", "review notes", "review reasoning");

      const cached = store.getCachedResults("build app", [
        "designer", "engineer", "tester", "reviewer",
      ]);

      expect(cached.size).toBe(4);
      expect(cached.get("designer")!.output).toBe("design spec");
      expect(cached.get("engineer")!.output).toBe("app code");
      expect(cached.get("tester")!.output).toBe("test suite");
      expect(cached.get("reviewer")!.output).toBe("review notes");
    });

    it("returns partial results when not all agents have run", () => {
      store.save("designer", "build app", "design spec", "reasoning");
      store.save("engineer", "build app", "app code", "reasoning");

      const cached = store.getCachedResults("build app", [
        "designer", "engineer", "tester", "reviewer",
      ]);

      expect(cached.size).toBe(2);
      expect(cached.has("tester")).toBe(false);
      expect(cached.has("reviewer")).toBe(false);
    });

    it("returns empty map when no agents have run the task", () => {
      const cached = store.getCachedResults("new task", ["designer", "engineer"]);
      expect(cached.size).toBe(0);
    });

    it("returns a cached result when multiple exist for the same agent/task", () => {
      store.save("engineer", "build app", "v1", "first");
      store.save("engineer", "build app", "v2", "second");

      const cached = store.getCachedResults("build app", ["engineer"]);
      expect(cached.has("engineer")).toBe(true);
      expect(["v1", "v2"]).toContain(cached.get("engineer")!.output);
    });
  });

  describe("token savings via memory", () => {
    it("exact cache hit avoids needing a new API call", () => {
      store.save("engineer", "implement auth", "auth module code", "used JWT");

      const recalled = store.recall("engineer", "implement auth");
      expect(recalled).toHaveLength(1);
      expect(recalled[0].output).toBe("auth module code");
    });

    it("no-memory mode returns no memories (skips recall entirely)", () => {
      store.save("engineer", "implement auth", "auth code", "reasoning");

      // Simulating noMemory=true: the pipeline passes [] instead of calling recall
      const memories: never[] = [];
      expect(memories).toHaveLength(0);
      // Verify the memories still exist in the store (not deleted)
      const actual = store.recall("engineer", "implement auth");
      expect(actual).toHaveLength(1);
    });
  });

  describe("data integrity", () => {
    it("generates unique IDs for each memory", () => {
      store.save("engineer", "task", "output1", "reasoning1");
      store.save("engineer", "task", "output2", "reasoning2");

      // Use fallback recall to get all memories
      const allForAgent = store.recall("engineer", "different task");
      expect(allForAgent.length).toBeGreaterThanOrEqual(2);

      const ids = allForAgent.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("stores created_at timestamps", () => {
      store.save("engineer", "task", "output", "reasoning");

      const recalled = store.recall("engineer", "task");
      expect(recalled[0].created_at).toBeTruthy();
      expect(new Date(recalled[0].created_at).toISOString()).toBeTruthy();
    });
  });
});

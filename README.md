# Agent Pipeline

A sequential multi-agent pipeline powered by the Claude API. Agents hand off work to each other in order, with automatic retry loops when a downstream agent requests revisions. Past decisions are stored in SQLite so agents can recall similar work and avoid redundant processing.

## How it works

```
Engineer → Tester → Reviewer → Designer
              ↑         ↑
         (revision) (revision)
```

Each agent receives the previous agent's output and any relevant memories from past runs. If the Tester or Reviewer finds problems, the pipeline jumps back to the Engineer (up to a configurable retry limit), then continues forward again.

## Setup

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

npm install
```

## Usage

```bash
# Run with the default example task
npm run dev

# Run with a custom task
npm run dev "Create a TypeScript class that manages a job queue with priority levels"
```

## Project structure

```
src/
├── agents/
│   ├── engineer.ts    # writes the implementation
│   ├── tester.ts      # writes tests, can send back to engineer
│   ├── reviewer.ts    # reviews quality, can send back to engineer
│   ├── designer.ts    # UX/frontend review
│   └── index.ts
├── memory/
│   └── store.ts       # SQLite-backed memory (save + recall past decisions)
├── pipeline/
│   ├── runner.ts      # calls Claude with structured tool output
│   └── pipeline.ts    # orchestrates the sequence and retry logic
├── types.ts
└── index.ts           # entry point
```

## Adding an agent

1. Create `src/agents/myagent.ts`:

```typescript
import { AgentConfig } from "../types";

export const myAgent: AgentConfig = {
  name: "myagent",
  systemPrompt: `You are a ... Your job is to ...`,
  onRevision: "engineer", // optional: jump back to this agent on failure
  maxRetries: 3,
};
```

2. Export it from `src/agents/index.ts`
3. Add it to the `agents` array in `src/index.ts`

## Memory

Agent decisions are stored in `memory.db` (SQLite) after each successful run. On future runs, each agent automatically receives relevant past decisions as context. The DB is gitignored — delete it to start fresh.

## Configuration

Each agent config accepts:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique agent identifier |
| `systemPrompt` | `string` | The agent's role and instructions |
| `onRevision` | `string?` | Agent to retry when this one returns `needs_revision` |
| `maxRetries` | `number?` | Max retries for this agent (default: 3) |

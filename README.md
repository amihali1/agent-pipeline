# Agent Pipeline

A sequential multi-agent pipeline powered by the Claude API. Agents hand off work to each other in order, with automatic retry loops when a downstream agent requests revisions. Past decisions are stored in SQLite so agents can recall similar work and avoid redundant processing.

## How it works

```
Designer → Engineer → Tester → Reviewer
                ↑         ↑
           (revision) (revision)
```

The Designer defines the spec first — UX requirements, component structure, accessibility constraints, and behaviour. The Engineer implements against that spec. The Tester verifies correctness and the Reviewer checks quality. If the Tester or Reviewer finds problems, the pipeline jumps back to the Engineer (up to a configurable retry limit), then continues forward again.

Each agent also receives relevant memories from past runs, so similar tasks benefit from previous decisions.

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
│   ├── designer.ts    # defines the design spec before any code is written
│   ├── engineer.ts    # implements against the designer's spec
│   ├── tester.ts      # writes tests, can send back to engineer
│   ├── reviewer.ts    # reviews quality, can send back to engineer
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

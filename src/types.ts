export interface AgentConfig {
  name: string;
  systemPrompt: string;
  /** Which agent to jump back to when this agent requests a revision */
  onRevision?: string;
  /** Max times this agent can be retried (default: 3) */
  maxRetries?: number;
}

export interface AgentOutput {
  status: "success" | "needs_revision";
  output: string;
  feedback?: string;
  reasoning: string;
}

export interface AgentResult extends AgentOutput {
  agentName: string;
  timestamp: Date;
  attempt: number;
}

export interface PipelineContext {
  task: string;
  history: AgentResult[];
}

export interface PipelineOptions {
  agents: AgentConfig[];
  noMemory?: boolean;
  onAgentComplete?: (result: AgentResult) => void;
}

export interface MemoryRecord {
  id: string;
  agent_name: string;
  input_hash: string;
  task: string;
  output: string;
  reasoning: string;
  created_at: string;
}

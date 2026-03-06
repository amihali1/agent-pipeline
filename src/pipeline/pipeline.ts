import { AgentConfig, AgentResult, PipelineContext, PipelineOptions } from "../types";
import { runAgent } from "./runner";

export async function runPipeline(
  task: string,
  options: PipelineOptions
): Promise<AgentResult[]> {
  const { agents, noMemory, onAgentComplete } = options;
  const context: PipelineContext = { task, history: [] };
  const results: AgentResult[] = [];

  // Track how many times each agent has been retried
  const retryCounts = new Map<string, number>();

  let i = 0;
  while (i < agents.length) {
    const agent = agents[i];
    const attempt = (retryCounts.get(agent.name) ?? 0) + 1;

    console.log(`\n[${agent.name.toUpperCase()}] Running (attempt ${attempt})...`);

    const output = await runAgent(agent, context, attempt, noMemory);

    const result: AgentResult = {
      ...output,
      agentName: agent.name,
      timestamp: new Date(),
      attempt,
    };

    results.push(result);
    context.history.push(result);
    onAgentComplete?.(result);

    if (output.status === "needs_revision" && agent.onRevision) {
      const retryIndex = agents.findIndex((a) => a.name === agent.onRevision);
      if (retryIndex === -1) {
        throw new Error(`onRevision agent "${agent.onRevision}" not found in pipeline`);
      }

      const retryAgent = agents[retryIndex];
      const retryCount = retryCounts.get(retryAgent.name) ?? 0;
      const retryMax = retryAgent.maxRetries ?? 3;

      if (retryCount >= retryMax) {
        console.warn(
          `[${agent.name.toUpperCase()}] Max retries reached for "${retryAgent.name}", moving on.`
        );
        i++;
      } else {
        console.log(
          `[${agent.name.toUpperCase()}] Requesting revision from "${agent.onRevision}"...`
        );
        retryCounts.set(retryAgent.name, retryCount + 1);
        i = retryIndex; // jump back in the pipeline
      }
    } else {
      retryCounts.set(agent.name, attempt);
      i++;
    }
  }

  return results;
}

import Anthropic from "@anthropic-ai/sdk";
import { AgentConfig, AgentOutput, AgentResult, PipelineContext } from "../types";
import { MemoryStore } from "../memory/store";

const client = new Anthropic();
const memory = new MemoryStore();

/** Tool that forces each agent to return structured output */
const OUTPUT_TOOL: Anthropic.Tool = {
  name: "submit_output",
  description: "Submit your completed output for this stage of the pipeline.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["success", "needs_revision"],
        description:
          "'success' = pass to next agent. 'needs_revision' = previous agent must redo their work.",
      },
      output: {
        type: "string",
        description: "Your deliverable for this stage.",
      },
      feedback: {
        type: "string",
        description:
          "Required if status is 'needs_revision'. Specific, actionable feedback for the previous agent.",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of your decision.",
      },
    },
    required: ["status", "output", "reasoning"],
  },
};

export async function runAgent(
  agent: AgentConfig,
  context: PipelineContext,
  attempt: number
): Promise<AgentOutput> {
  const memories = memory.recall(agent.name, context.task);
  const previousResult = context.history[context.history.length - 1] as AgentResult | undefined;

  const userMessage = buildUserMessage(context.task, memories, previousResult);

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: agent.systemPrompt,
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Agent "${agent.name}" did not call submit_output`);
  }

  const output = toolUse.input as AgentOutput;

  if (output.status === "success" && output.output && output.reasoning) {
    memory.save(agent.name, context.task, output.output, output.reasoning);
  }

  return output;
}

function buildUserMessage(
  task: string,
  memories: ReturnType<MemoryStore["recall"]>,
  previousResult?: AgentResult
): string {
  const parts: string[] = [`# Task\n${task}`];

  if (memories.length > 0) {
    parts.push(
      `# Relevant Past Decisions\n` +
        memories
          .map((m) => `**${m.agent_name}** previously handled a similar task:\n${m.output}`)
          .join("\n\n")
    );
  }

  if (previousResult) {
    parts.push(`# Input from ${previousResult.agentName}\n${previousResult.output}`);
    if (previousResult.feedback) {
      parts.push(`# Revision Feedback to Address\n${previousResult.feedback}`);
    }
  }

  return parts.join("\n\n---\n\n");
}

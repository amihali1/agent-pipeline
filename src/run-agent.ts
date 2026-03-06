import "dotenv/config";
import fs from "fs";
import { runAgent } from "./pipeline/runner";
import { engineer, tester, reviewer, designer } from "./agents";
import { AgentConfig, PipelineContext } from "./types";

const agentMap: Record<string, AgentConfig> = {
  designer,
  engineer,
  tester,
  reviewer,
};

function usage(): never {
  console.error(`
Usage: npm run agent -- <agent-name> [options] [task]

Agents: ${Object.keys(agentMap).join(", ")}

Options:
  --no-memory       Skip memory recall
  --input <file>    Provide input from a previous agent (file path or "-" for stdin)

Examples:
  npm run agent -- designer "Build a REST API"
  npm run agent -- engineer "Build a REST API" --input output/designer.md
  npm run agent -- tester --input output/engineer.md
`.trim());
  process.exit(1);
}

async function readInput(inputArg: string): Promise<string> {
  if (inputArg === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf-8").trim();
  }
  return fs.readFileSync(inputArg, "utf-8").trim();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const agentName = args[0];
  const agent = agentMap[agentName];
  if (!agent) {
    console.error(`Unknown agent: "${agentName}". Available: ${Object.keys(agentMap).join(", ")}`);
    process.exit(1);
  }

  const noMemory = args.includes("--no-memory");
  const inputIdx = args.indexOf("--input");
  const inputFile = inputIdx !== -1 ? args[inputIdx + 1] : undefined;

  const task = args.find((a, i) => i > 0 && !a.startsWith("--") && (inputIdx === -1 || i !== inputIdx + 1))
    ?? "Create a TypeScript function that validates email addresses and returns detailed error messages for each validation failure.";

  console.log(`\nAgent: ${agentName}`);
  console.log(`Task: "${task}"`);
  console.log("=".repeat(60));

  const context: PipelineContext = { task, history: [] };

  // If input provided, add it as a previous agent result
  if (inputFile) {
    const input = await readInput(inputFile);
    console.log(`Input: ${inputFile} (${input.length} chars)`);
    context.history.push({
      agentName: "previous",
      status: "success",
      output: input,
      reasoning: "",
      timestamp: new Date(),
      attempt: 1,
    });
  }

  console.log("");

  const output = await runAgent(agent, context, 1, noMemory);

  console.log(`\nStatus: ${output.status}`);
  if (output.feedback) console.log(`Feedback: ${output.feedback}`);
  console.log(`\n${"=".repeat(60)}\n`);
  console.log(output.output);

  // Save to output directory
  const outputDir = "output";
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = `${outputDir}/${agentName}.md`;
  fs.writeFileSync(outPath, `# ${agentName.toUpperCase()} Output\n\n${output.output}\n`);
  console.log(`\nSaved to ${outPath}`);
}

main().catch((err) => {
  console.error("Agent run failed:", err);
  process.exit(1);
});

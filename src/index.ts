import "dotenv/config";
import { runPipeline } from "./pipeline/pipeline";
import { engineer, tester, reviewer, designer } from "./agents";
import { AgentResult } from "./types";

async function main() {
  const task =
    process.argv[2] ??
    "Create a TypeScript function that validates email addresses and returns detailed error messages for each validation failure.";

  console.log(`\nTask: "${task}"`);
  console.log("=".repeat(60));

  const results = await runPipeline(task, {
    agents: [designer, engineer, tester, reviewer],
    onAgentComplete: (result: AgentResult) => {
      const icon = result.status === "success" ? "✓" : "↩";
      console.log(`${icon} [${result.agentName}] ${result.status}`);
      if (result.status === "needs_revision") {
        console.log(`  Feedback: ${result.feedback}`);
      }
    },
  });

  console.log("\n" + "=".repeat(60));
  console.log("\nFinal outputs:\n");

  // Print the last successful output from each agent
  const seen = new Set<string>();
  for (const result of [...results].reverse()) {
    if (!seen.has(result.agentName) && result.status === "success") {
      seen.add(result.agentName);
      console.log(`\n## ${result.agentName.toUpperCase()}\n`);
      console.log(result.output);
    }
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});

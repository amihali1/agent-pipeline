import "dotenv/config";
import fs from "fs";
import path from "path";
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

  // Collect the last successful output from each agent
  const finalOutputs = new Map<string, AgentResult>();
  for (const result of [...results].reverse()) {
    if (!finalOutputs.has(result.agentName) && result.status === "success") {
      finalOutputs.set(result.agentName, result);
    }
  }

  // Print to console
  for (const [name, result] of finalOutputs) {
    console.log(`\n## ${name.toUpperCase()}\n`);
    console.log(result.output);
  }

  // Write to output directory
  const outputDir = path.join(process.cwd(), "output");
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [name, result] of finalOutputs) {
    const filePath = path.join(outputDir, `${name}.md`);
    fs.writeFileSync(filePath, `# ${name.toUpperCase()} Output\n\n${result.output}\n`);
  }

  console.log(`\nOutputs saved to ${outputDir}/`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});

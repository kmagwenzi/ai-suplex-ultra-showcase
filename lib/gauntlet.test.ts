import { describe, it, expect } from "vitest";
import { runGauntlet, evidenceSummary } from "./gauntlet";
import { classicRetrieve, graphRetrieve } from "./retrieval";
import { loadGraph } from "./graph";

function fakeModel() {
  return {
    generate: async (prompt: string) => {
      const lines = prompt.split("\n");
      const nodesLine = lines.find((l) => l.startsWith("Nodes: "));
      return nodesLine ? "Based on the evidence: " + nodesLine.slice(7) + "." : "No evidence.";
    },
  };
}

describe("gauntlet", () => {
  it("improves from classic (A) to graph (B) retrieval", async () => {
    const g = loadGraph("revenue");
    const r = await runGauntlet("which client should I upsell", g, fakeModel(), { a: classicRetrieve, b: graphRetrieve });
    expect(r.b.score).toBeGreaterThan(r.a.score);
    expect(r.lesson.length).toBeGreaterThan(0);
  });

  it("evidence summary carries nodes and edges", () => {
    const g = loadGraph("revenue");
    const s = evidenceSummary(g, graphRetrieve(g, "which client should I upsell"));
    expect(s).toContain("Nodes:");
    expect(s).toContain("adjacent");
  });
});

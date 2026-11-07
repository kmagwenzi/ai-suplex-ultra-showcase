import { describe, it, expect } from "vitest";
import { runGauntlet, evidenceSummary } from "./gauntlet";
import { classicRetrieve, graphRetrieve } from "./retrieval";
import { loadGraph } from "./graph";

function fakeModel() {
  return {
    generate: async (prompt: string) => {
      const lines = prompt.split("\n");
      const nodesLine = lines.find((l) => l.startsWith("Nodes: "));
      const edgesLine = lines.find((l) => l.startsWith("Edges: "));
      return (
        "Based on the evidence: " +
        (nodesLine ? nodesLine.slice(7) : "") +
        (edgesLine ? " via " + edgesLine.slice(7) : "") +
        "."
      );
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

  it("emits stages via the onStage callback", async () => {
    const g = loadGraph("revenue");
    const stages: string[] = [];
    await runGauntlet("which client should I upsell", g, fakeModel(), { a: classicRetrieve, b: graphRetrieve }, (stage) => stages.push(stage));
    expect(stages).toContain("evidence_a");
    expect(stages).toContain("score_a");
    expect(stages).toContain("lesson");
    expect(stages).toContain("score_b");
  });
});


describe("display evidence", () => {
  it("caps and dedupes what a human reads", () => {
    const g = loadGraph("knowledge-base");
    const r = graphRetrieve(g, "what is the difference between AI-Suplex 777 and Ultra");
    const full = evidenceSummary(g, r);
    const shown = evidenceSummary(g, r, { mode: "display" });
    expect(shown.length).toBeLessThan(full.length);
    expect(shown).toContain("more");
    expect(shown.split("\n").length).toBeLessThanOrEqual(3);
  });

  it("keeps the prompt path rich", () => {
    const g = loadGraph("knowledge-base");
    const r = graphRetrieve(g, "what is the difference between AI-Suplex 777 and Ultra");
    const full = evidenceSummary(g, r);
    expect(full).toContain("—");
    expect(evidenceSummary(g, r, { mode: "prompt" })).toBe(full);
  });
});

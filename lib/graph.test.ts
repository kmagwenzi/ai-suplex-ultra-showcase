import { describe, it, expect } from "vitest";
import { loadGraph, parseGraph, validateGraph } from "./graph";

describe("curated graphs", () => {
  it("loads and validates the technical graph", () => {
    const g = loadGraph("technical");
    expect(g.nodes.length).toBeGreaterThan(15);
    expect(g.edges.length).toBeGreaterThan(15);
  });

  it("loads and validates the revenue graph", () => {
    const g = loadGraph("revenue");
    expect(g.nodes.length).toBeGreaterThan(15);
    expect(g.edges.length).toBeGreaterThan(15);
  });

  it("rejects duplicate node ids", () => {
    const bad = { name: "x", nodes: [{ id: "a", type: "module" }, { id: "a", type: "tool" }], edges: [] };
    expect(validateGraph(bad as any)).toContain("duplicate node id: a");
  });

  it("rejects edges to unknown nodes", () => {
    const bad = { name: "x", nodes: [{ id: "a", type: "module" }], edges: [{ from: "a", to: "ghost", rel: "feeds" }] };
    expect(validateGraph(bad as any)).toContain("edge to unknown node: ghost");
  });

  it("parses valid JSON into a graph", () => {
    const g = parseGraph(JSON.stringify({ name: "x", nodes: [{ id: "a", type: "module" }], edges: [] }));
    expect(g.name).toBe("x");
  });
});

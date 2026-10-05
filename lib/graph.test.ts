import { describe, it, expect } from "vitest";
import { loadGraph, parseGraph, validateGraph } from "./graph";

describe("curated graphs", () => {
  it("loads and validates the knowledge-base graph", () => {
    const g = loadGraph("knowledge-base");
    expect(g.nodes.length).toBeGreaterThanOrEqual(36);
    expect(g.edges.length).toBeGreaterThanOrEqual(45);
    const wqr = g.nodes.find((n) => n.id === "wqr") as { status?: string; link?: string } | undefined;
    expect(wqr?.status).toBe("live");
    expect(wqr?.link).toBe("wqr.co.zw");
    expect(g.nodes.some((n) => n.id === "agents-terminal")).toBe(true);
    expect(g.nodes.some((n) => n.id === "ultra-harness")).toBe(true);
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

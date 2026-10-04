import { describe, it, expect } from "vitest";
import { classicRetrieve, graphRetrieve, contrast } from "./retrieval";
import { loadGraph } from "./graph";

describe("classic retrieval (Stage A)", () => {
  it("matches query tokens against node text, finds no edges", () => {
    const g = loadGraph("revenue");
    const r = classicRetrieve(g, "which client should I upsell");
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.node.type === "client")).toBe(true);
    expect(r.edges.length).toBe(0);
  });

  it("matches a PLURAL query token to a singular node type (the real demo question)", () => {
    const g = loadGraph("revenue");
    const r = classicRetrieve(g, "Which of my clients is most likely to buy again, and what exactly should I pitch?");
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.node.type === "client")).toBe(true);
  });

  it("finds mentions but not structure — the upsell service is absent", () => {
    const g = loadGraph("revenue");
    const r = classicRetrieve(g, "which client should I upsell");
    expect(r.hits.map((h) => h.node.id)).not.toContain("delivery-tracking");
  });
});

describe("graph retrieval (Stage B)", () => {
  it("follows edges to the cross-sell service classic missed", () => {
    const g = loadGraph("revenue");
    const r = graphRetrieve(g, "which client should I upsell");
    const ids = r.hits.map((h) => h.node.id);
    expect(ids).toContain("delivery-tracking");
    expect(r.edges.some((e) => e.rel === "adjacent")).toBe(true);
  });
});

describe("contrast (Stage A vs B)", () => {
  it("graph finds the structure classic misses", () => {
    const g = loadGraph("revenue");
    const c = contrast(g, "which client should I upsell");
    const classicIds = c.classic.hits.map((h) => h.node.id);
    const graphIds = c.graph.hits.map((h) => h.node.id);
    expect(classicIds).not.toContain("delivery-tracking");
    expect(graphIds).toContain("delivery-tracking");
    expect(c.graph.edges.length).toBeGreaterThan(c.classic.edges.length);
  });
});

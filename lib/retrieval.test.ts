import { describe, it, expect } from "vitest";
import { classicRetrieve } from "./retrieval";
import { loadGraph } from "./graph";

describe("classic retrieval (Stage A)", () => {
  it("matches query tokens against node text, finds no edges", () => {
    const g = loadGraph("revenue");
    const r = classicRetrieve(g, "which client should I upsell");
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.node.type === "client")).toBe(true);
    expect(r.edges.length).toBe(0);
  });

  it("finds mentions but not structure — the upsell service is absent", () => {
    const g = loadGraph("revenue");
    const r = classicRetrieve(g, "which client should I upsell");
    const ids = r.hits.map((h) => h.node.id);
    expect(ids).not.toContain("delivery-tracking");
  });
});

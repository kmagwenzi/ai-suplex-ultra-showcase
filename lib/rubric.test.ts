import { describe, it, expect } from "vitest";
import { scoreAnswer, distillLesson } from "./rubric";
import { loadGraph } from "./graph";

describe("rubric", () => {
  it("scores a structure-aware answer higher than a mentions-only answer", () => {
    const g = loadGraph("revenue");
    const deepOnly = ["delivery-tracking"];
    const poor = "Your clients are Acme Logistics, Harare Beauty Co, and Gweru Auto Parts.";
    const good = "Pitch Delivery Tracking to Acme Logistics for $800-2000 — they bought WhatsApp Ordering, and delivery tracking is its adjacent service.";
    const sp = scoreAnswer(poor, g, "which client should I upsell", deepOnly);
    const sg = scoreAnswer(good, g, "which client should I upsell", deepOnly);
    expect(sg.score).toBeGreaterThan(sp.score);
    expect(sg.breakdown.complete).toBe(3);
    expect(sp.breakdown.complete).toBe(0);
    expect(sp.failures.length).toBeGreaterThan(sg.failures.length);
  });

  it("distills failures into an imperative lesson", () => {
    const r = { score: 3, breakdown: { grounded: 3, complete: 0, actionable: 0, specific: 0 }, failures: ["answer does not use the relationship structure that keyword search missed"] };
    expect(distillLesson(r)).toContain("relationship structure");
  });
});

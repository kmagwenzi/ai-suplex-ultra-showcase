import { describe, it, expect } from "vitest";
import { scoreAnswer, distillLesson } from "./rubric";
import { loadGraph } from "./graph";

describe("rubric", () => {
  it("rewards an answer that uses a relationship and a real figure", () => {
    const g = loadGraph("revenue");
    const poor = "Your clients are Acme Logistics, Harare Beauty Co, and Gweru Auto Parts.";
    const good = "Pitch Delivery Tracking to Acme Logistics for $800-2000 — they bought WhatsApp Ordering, and delivery tracking is its adjacent service.";
    const sp = scoreAnswer(poor, g, "which client should I upsell");
    const sg = scoreAnswer(good, g, "which client should I upsell");
    expect(sg.score).toBeGreaterThan(sp.score);
    expect(sg.breakdown.complete).toBe(3);
    expect(sg.breakdown.specific).toBe(2);
    expect(sp.failures.length).toBeGreaterThan(sg.failures.length);
  });

  it("does NOT credit a relationship the stage evidence never contained", () => {
    const g = loadGraph("revenue");
    const r = scoreAnswer("Acme bought via the delivered_to relationship.", g, "q", { evidenceRels: [] });
    expect(r.breakdown.complete).toBe(0);
  });

  it("does NOT award specific for a bare node id digit", () => {
    const g = loadGraph("revenue");
    const r = scoreAnswer("The project p4 uses Booking, and no price band exists.", g, "q");
    expect(r.breakdown.specific).toBe(0);
  });

  it("distills failures into an imperative lesson", () => {
    const r = { score: 3, breakdown: { grounded: 3, complete: 0, actionable: 0, specific: 0 }, failures: ["answer does not use a relationship from the evidence graph"] };
    expect(distillLesson(r)).toContain("relationship");
  });
});

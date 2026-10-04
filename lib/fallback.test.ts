import { describe, it, expect } from "vitest";
import { withFallback, truncate } from "./fallback";
import type { GauntletResult } from "./gauntlet";

const recorded: GauntletResult = {
  a: { answer: "Your clients are Acme Logistics and others.", score: 3, failures: ["answer does not follow an adjacent relationship to an upsell service"] },
  b: { answer: "Pitch Delivery Tracking to Acme Logistics.", score: 9, failures: [] },
  lesson: "Follow the adjacent relationship to an upsell service.",
};

describe("fallback", () => {
  it("returns the live result when the run succeeds", async () => {
    const r = await withFallback(async () => recorded, recorded);
    expect(r.replay).toBeUndefined();
    expect(r.b.score).toBe(9);
  });

  it("returns the recorded result with a replay flag when the run throws", async () => {
    const r = await withFallback(async () => { throw new Error("model down"); }, recorded);
    expect(r.replay).toBe(true);
    expect(r.b.score).toBe(9);
    expect(r.lesson).toContain("adjacent");
  });

  it("truncates long text", () => {
    expect(truncate("1234567890", 5)).toBe("12345...");
  });
});

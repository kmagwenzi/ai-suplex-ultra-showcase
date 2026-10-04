import type { Graph } from "./graph";

export interface RubricBreakdown {
  grounded: number;
  complete: number;
  actionable: number;
  specific: number;
}

export interface ScoreResult {
  score: number;
  breakdown: RubricBreakdown;
  failures: string[];
}

export function scoreAnswer(answer: string, g: Graph, _query: string): ScoreResult {
  const lower = answer.toLowerCase();
  const names = g.nodes.map((n) => ({
    id: n.id,
    name: String(n.name || n.label || n.id).toLowerCase(),
  }));

  const mentioned = names.filter((x) => x.name.length > 0 && lower.includes(x.name));
  const grounded = mentioned.length >= 3 ? 3 : mentioned.length >= 1 ? 2 : 0;

  const adjacentIds = new Set<string>();
  for (const e of g.edges) {
    if (e.rel === "adjacent") {
      adjacentIds.add(e.from);
      adjacentIds.add(e.to);
    }
  }
  const mentionsAdjacent = mentioned.some((x) => adjacentIds.has(x.id));
  const complete = mentionsAdjacent ? 3 : 0;

  const hasAction = /(pitch|offer|sell|upsell|recommend|bundle|next)/.test(lower);
  const actionable = hasAction ? 2 : 0;

  const hasFigure = /[0-9]/.test(answer) || answer.includes("$");
  const specific = hasFigure ? 2 : 0;

  const score = grounded + complete + actionable + specific;
  const failures: string[] = [];
  if (grounded < 3) failures.push("answer cites fewer than three entities from the evidence");
  if (!mentionsAdjacent) failures.push("answer does not follow an adjacent relationship to an upsell service");
  if (!hasAction) failures.push("answer names no concrete next action");
  if (!hasFigure) failures.push("answer cites no specific figure or price");

  return { score, breakdown: { grounded, complete, actionable, specific }, failures };
}

export function distillLesson(r: ScoreResult): string {
  if (r.failures.length === 0) return "Nothing to fix.";
  return r.failures.map((f, i) => (i + 1) + ". " + f).join(" ");
}

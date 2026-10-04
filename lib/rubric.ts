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

function normalize(s: unknown): string {
  return String(s ?? "").toLowerCase();
}

export function scoreAnswer(
  answer: string,
  g: Graph,
  _query: string,
  deepOnlyIds?: string[],
): ScoreResult {
  const lower = answer.toLowerCase();
  const names = g.nodes.map((n) => ({ id: n.id, name: normalize(n.name || n.label || n.id) }));

  const mentioned = names.filter((x) => x.name.length > 0 && lower.includes(x.name));
  const grounded = mentioned.length >= 3 ? 3 : mentioned.length >= 1 ? 2 : 0;

  const deepIds = new Set(deepOnlyIds ?? []);
  const rels = g.edges.map((e) => e.rel);
  const citesRelationship = rels.some((r) => r.length > 2 && lower.includes(r));
  const citesDeepNode = mentioned.some((x) => deepIds.has(x.id));
  const complete = citesRelationship || citesDeepNode ? 3 : 0;

  const hasAction = /(pitch|offer|sell|upsell|recommend|bundle|build|prioriti[sz]e|next|focus)/.test(lower);
  const actionable = hasAction ? 2 : 0;

  const hasFigure = /[0-9]{2,}/.test(answer) || answer.includes("$");
  const specific = hasFigure ? 2 : 0;

  const score = grounded + complete + actionable + specific;
  const failures: string[] = [];
  if (grounded < 3) failures.push("answer cites fewer than three entities from the evidence");
  if (complete === 0) failures.push("answer does not use a relationship from the evidence graph");
  if (!hasAction) failures.push("answer names no concrete next action");
  if (!hasFigure) failures.push("answer cites no specific figure or price band");

  return { score, breakdown: { grounded, complete, actionable, specific }, failures };
}

export function distillLesson(r: ScoreResult): string {
  if (r.failures.length === 0) return "Nothing to fix.";
  return r.failures.map((f, i) => (i + 1) + ". " + f).join(" ");
}

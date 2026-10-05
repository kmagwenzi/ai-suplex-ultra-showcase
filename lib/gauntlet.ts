import type { Graph } from "./graph";
import type { RetrievalResult } from "./retrieval";
import { scoreAnswer, distillLesson } from "./rubric";

export interface Model {
  generate(prompt: string): Promise<string>;
}

export interface StageResult {
  answer: string;
  score: number;
  failures: string[];
}

export interface GauntletResult {
  a: StageResult;
  b: StageResult;
  lesson: string;
}

export type StageCallback = (stage: string, data: unknown) => void;

const INSTRUCTIONS =
  "Answer strictly from the evidence graph below. The Edges list is the NEW information: follow it " +
  "(for example built_on, uses, applies, ships_as, part_of, powers, feeds, depends_on, delivered_to) and name the relationship " +
  "you used. Cite exact entity names. Name one concrete next action. Include any status, stack, link or price band shown next to a node. " +
  "Two or three sentences maximum.";

function nodeLabel(g: Graph, id: string): string {
  const n = g.nodes.find((x) => x.id === id);
  if (!n) return id;
  const parts: string[] = [String(n.name || n.label || n.id)];
  if (n.industry) parts.push("[" + String(n.industry) + "]");
  const band = n.price_band as number[] | undefined;
  if (Array.isArray(band)) parts.push("($" + band.join("-") + ")");
  if (typeof n.price === "number") parts.push("($" + n.price + ")");
  if (n.status) parts.push("[" + String(n.status) + "]");
  const stack = n.stack as string[] | undefined;
  if (Array.isArray(stack) && stack.length > 0) parts.push("{" + stack.join(", ") + "}");
  if (n.link) parts.push("(" + String(n.link) + ")");
  if (n.desc) parts.push("— " + String(n.desc));
  return parts.join(" ");
}

export function evidenceSummary(g: Graph, r: RetrievalResult): string {
  const names = r.hits.map((h) => nodeLabel(g, h.node.id)).join(", ");
  const rels = r.edges.map((e) => nodeLabel(g, e.from) + " -" + e.rel + "-> " + nodeLabel(g, e.to)).join("; ");
  return "Nodes: " + names + "\nEdges: " + rels;
}

export async function runGauntlet(
  query: string,
  g: Graph,
  model: Model,
  retrieve: {
    a: (g: Graph, q: string) => RetrievalResult;
    b: (g: Graph, q: string) => RetrievalResult;
  },
  onStage?: StageCallback,
): Promise<GauntletResult> {
  const evA = retrieve.a(g, query);
  const evB = retrieve.b(g, query);
  const relsA = evA.edges.map((e) => e.rel);
  const relsB = evB.edges.map((e) => e.rel);

  onStage?.("evidence_a", { text: evidenceSummary(g, evA) });
  const promptA = INSTRUCTIONS + "\n\nQuestion: " + query + "\n\nEvidence:\n" + evidenceSummary(g, evA) + "\n\nAnswer:";
  const ansA = await model.generate(promptA);
  const resultA = scoreAnswer(ansA, g, query, { evidenceRels: relsA });
  onStage?.("score_a", { score: resultA.score, answer: ansA });

  const lesson = distillLesson(resultA);
  onStage?.("lesson", { text: lesson });

  onStage?.("evidence_b", { text: evidenceSummary(g, evB) });
  const promptB =
    INSTRUCTIONS +
    "\n\nQuestion: " + query +
    "\n\nEvidence:\n" + evidenceSummary(g, evB) +
    "\n\nA previous attempt scored " + resultA.score + "/10. Address these failures: " + lesson +
    "\n\nAnswer:";
  const ansB = await model.generate(promptB);
  const resultB = scoreAnswer(ansB, g, query, { evidenceRels: relsB });
  onStage?.("score_b", { score: resultB.score, answer: ansB });

  return {
    a: { answer: ansA, score: resultA.score, failures: resultA.failures },
    b: { answer: ansB, score: resultB.score, failures: resultB.failures },
    lesson,
  };
}

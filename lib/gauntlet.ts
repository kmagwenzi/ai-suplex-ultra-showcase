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

function nodeName(g: Graph, id: string): string {
  const n = g.nodes.find((x) => x.id === id);
  return n ? String(n.name || n.label || n.id) : id;
}

export function evidenceSummary(g: Graph, r: RetrievalResult): string {
  const names = r.hits.map((h) => nodeName(g, h.node.id)).join(", ");
  const rels = r.edges.map((e) => nodeName(g, e.from) + " -" + e.rel + "-> " + nodeName(g, e.to)).join("; ");
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
  onStage?.("evidence_a", { text: evidenceSummary(g, evA) });
  const ansA = await model.generate("Question: " + query + "\nEvidence:\n" + evidenceSummary(g, evA) + "\nAnswer:");
  const resultA = scoreAnswer(ansA, g, query);
  onStage?.("score_a", { score: resultA.score, answer: ansA });
  const lesson = distillLesson(resultA);
  onStage?.("lesson", { text: lesson });

  const evB = retrieve.b(g, query);
  onStage?.("evidence_b", { text: evidenceSummary(g, evB) });
  const ansB = await model.generate("Question: " + query + "\nEvidence:\n" + evidenceSummary(g, evB) + "\nLesson from previous attempt: " + lesson + "\nAnswer:");
  const resultB = scoreAnswer(ansB, g, query);
  onStage?.("score_b", { score: resultB.score, answer: ansB });

  return {
    a: { answer: ansA, score: resultA.score, failures: resultA.failures },
    b: { answer: ansB, score: resultB.score, failures: resultB.failures },
    lesson,
  };
}

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
  "Answer strictly from the evidence graph below. Follow its relationship edges " +
  "(for example uses_service, adjacent, powers, feeds, depends_on). Cite the exact entity names. " +
  "Name one concrete next action. Include any price band you find. Two or three sentences maximum.";

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
  const evB = retrieve.b(g, query);
  const aIds = new Set(evA.hits.map((h) => h.node.id));
  const deepOnly = evB.hits.filter((h) => !aIds.has(h.node.id)).map((h) => h.node.id);

  onStage?.("evidence_a", { text: evidenceSummary(g, evA) });
  const promptA = INSTRUCTIONS + "\n\nQuestion: " + query + "\n\nEvidence:\n" + evidenceSummary(g, evA) + "\n\nAnswer:";
  const ansA = await model.generate(promptA);
  const resultA = scoreAnswer(ansA, g, query, deepOnly);
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
  const resultB = scoreAnswer(ansB, g, query, deepOnly);
  onStage?.("score_b", { score: resultB.score, answer: ansB });

  return {
    a: { answer: ansA, score: resultA.score, failures: resultA.failures },
    b: { answer: ansB, score: resultB.score, failures: resultB.failures },
    lesson,
  };
}

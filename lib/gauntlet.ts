import type { Graph, GraphNode } from "./graph";
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

// Short display name for the SVG visual (strip the " — subtitle" from KB labels).
function shortLabel(n: GraphNode): string {
  const raw = String(n.name || n.label || n.id);
  const em = raw.indexOf(" — ");
  return em >= 0 ? raw.slice(0, em) : raw;
}

// Display-only label: the name plus the one detail a reader needs. Descriptions,
// stacks and links belong in the prompt, not in the panel the buyer reads.
function displayLabel(n: GraphNode): string {
  const parts: string[] = [shortLabel(n)];
  if (n.status) parts.push("[" + String(n.status) + "]");
  const band = n.price_band as number[] | undefined;
  if (Array.isArray(band)) parts.push("($" + band.join("-") + ")");
  else if (typeof n.price === "number") parts.push("($" + n.price + ")");
  return parts.join(" ");
}

function nameOf(g: Graph, id: string): string {
  const n = g.nodes.find((x) => x.id === id);
  return n ? shortLabel(n) : id;
}

// What a human reads: capped and deduped. What the model reads: everything.
const TEXT_MAX_NODES = 8;
const TEXT_MAX_EDGES = 12;
const GRAPH_MAX_NODES = 14;
const GRAPH_MAX_EDGES = 18;

function displayNodes(r: RetrievalResult): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const h of r.hits) {
    if (seen.has(h.node.id)) continue;
    seen.add(h.node.id);
    out.push({ id: h.node.id, label: shortLabel(h.node) });
    if (out.length >= GRAPH_MAX_NODES) break;
  }
  return out;
}

function displayEdges(r: RetrievalResult): { from: string; to: string; rel: string }[] {
  const keep = new Set(displayNodes(r).map((n) => n.id));
  const out: { from: string; to: string; rel: string }[] = [];
  for (const e of r.edges) {
    if (!keep.has(e.from) || !keep.has(e.to)) continue;
    out.push({ from: e.from, to: e.to, rel: e.rel });
    if (out.length >= GRAPH_MAX_EDGES) break;
  }
  return out;
}

function tierLabel(r: RetrievalResult): string {
  switch (r.tier) {
    case "strict":
      return "matched " + r.hits.length + " nodes";
    case "relaxed":
      return "relaxed match";
    case "hubs":
      return "no lexical match — seeded from graph hubs";
    default:
      return "";
  }
}

export interface EvidenceOptions {
  /** "prompt" sends the model everything the retriever found; "display" is what a human reads. */
  mode?: "prompt" | "display";
  maxNodes?: number;
  maxEdges?: number;
}

export function evidenceSummary(
  g: Graph,
  r: RetrievalResult,
  opts: EvidenceOptions = {},
): string {
  const tier = tierLabel(r);

  if ((opts.mode ?? "prompt") === "prompt") {
    const names = r.hits.map((h) => nodeLabel(g, h.node.id)).join(", ");
    const rels = r.edges.map((e) => nodeLabel(g, e.from) + " -" + e.rel + "-> " + nodeLabel(g, e.to)).join("; ");
    return (tier ? tier + "\n" : "") + "Nodes: " + names + "\nEdges: " + rels;
  }

  const maxNodes = opts.maxNodes ?? TEXT_MAX_NODES;
  const maxEdges = opts.maxEdges ?? TEXT_MAX_EDGES;

  const names: string[] = [];
  const seen = new Set<string>();
  for (const h of r.hits) {
    const label = displayLabel(h.node);
    if (seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }

  const head = (tier ? tier + " · " : "") + names.length + " nodes · " + r.edges.length + " edges";
  const nodeLine =
    "Nodes: " +
    names.slice(0, maxNodes).join(", ") +
    (names.length > maxNodes ? " …+" + (names.length - maxNodes) + " more" : "");

  const rels = r.edges
    .slice(0, maxEdges)
    .map((e) => nameOf(g, e.from) + " -" + e.rel + "-> " + nameOf(g, e.to));
  const edgeLine =
    rels.length === 0
      ? "Edges: none — keyword retrieval returns no relationships"
      : "Edges: " + rels.join(", ") + (r.edges.length > maxEdges ? " …+" + (r.edges.length - maxEdges) + " more" : "");

  return head + "\n" + nodeLine + "\n" + edgeLine;
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

  onStage?.("evidence_a", {
    text: evidenceSummary(g, evA, { mode: "display" }),
    nodes: displayNodes(evA),
    edges: [],
  });
  const promptA = INSTRUCTIONS + "\n\nQuestion: " + query + "\n\nEvidence:\n" + evidenceSummary(g, evA) + "\n\nAnswer:";
  const ansA = await model.generate(promptA);
  const resultA = scoreAnswer(ansA, g, query, { evidenceRels: relsA });
  onStage?.("score_a", { score: resultA.score, answer: ansA });

  const lesson = distillLesson(resultA);
  onStage?.("lesson", { text: lesson });

  onStage?.("evidence_b", {
    text: evidenceSummary(g, evB, { mode: "display" }),
    nodes: displayNodes(evB),
    edges: displayEdges(evB),
  });
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

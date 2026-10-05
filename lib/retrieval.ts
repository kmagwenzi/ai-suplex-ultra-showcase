import type { Graph, GraphNode } from "./graph";

export interface RetrievalHit { node: GraphNode; reason: string; }
export interface RetrievalResult {
  hits: RetrievalHit[];
  edges: { from: string; to: string; rel: string }[];
  /** Which fallback tier produced the hits — surfaced in the Source card. */
  tier?: "strict" | "relaxed" | "hubs";
}

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "in", "into", "is", "it",
  "its", "me", "most", "my", "not", "of", "on", "or", "our", "should", "so",
  "that", "the", "their", "them", "they", "this", "to", "up", "was", "we",
  "were", "what", "which", "who", "will", "with", "would", "you", "your", "exactly",
]);

// Minimum token length. Drops single-character noise ("7" from "7-7-7") so a real
// word must drive the match.
function tokens(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOP.has(t));
}

function variants(t: string): string[] {
  const set = new Set<string>([t]);
  if (t.length > 3 && t.endsWith("es")) set.add(t.slice(0, -2));
  if (t.length > 3 && t.endsWith("s")) set.add(t.slice(0, -1));
  if (!t.endsWith("s")) set.add(t + "s");
  return [...set];
}

function nodeText(n: GraphNode): string {
  return [n.label, n.name, n.desc, n.industry, n.type]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
}

// Tier 1: a token (or its stem variant) matches a WHOLE word in the node text.
function wordMatch(text: string, t: string): boolean {
  const words = text.split(/[^a-z0-9]+/);
  return variants(t).some((v) => words.includes(v));
}

// Tier 2: a token is the PREFIX of a whole word in the node text.
function prefixMatch(text: string, t: string): boolean {
  return text.split(/[^a-z0-9]+/).some((w) => w.startsWith(t));
}

// Tier 3: the highest-degree nodes, so the retrieval never returns empty.
function topHubs(g: Graph, k: number): RetrievalHit[] {
  const degree = new Map<string, number>();
  for (const e of g.edges) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }
  return [...g.nodes]
    .map((n) => ({ node: n, deg: degree.get(n.id) || 0 }))
    .sort((a, b) => b.deg - a.deg)
    .slice(0, k)
    .map((x) => ({ node: x.node, reason: "graph hub (degree " + x.deg + ")" }));
}

export function classicRetrieve(g: Graph, query: string): RetrievalResult {
  const toks = tokens(query);

  // Tier 1 — strict whole-word (stem-variant) match
  const strict = g.nodes.filter((n) => toks.some((t) => wordMatch(nodeText(n), t)));
  if (strict.length > 0) {
    return { hits: strict.map((n) => ({ node: n, reason: "matched token" })), edges: [], tier: "strict" };
  }

  // Tier 2 — relaxed prefix match on tokens >= 4 chars
  const prefixToks = toks.filter((t) => t.length >= 4);
  const relaxed = g.nodes.filter((n) => prefixToks.some((t) => prefixMatch(nodeText(n), t)));
  if (relaxed.length > 0) {
    return { hits: relaxed.map((n) => ({ node: n, reason: "prefix match" })), edges: [], tier: "relaxed" };
  }

  // Tier 3 — no lexical match: seed from the graph hubs, and say so
  return { hits: topHubs(g, 4), edges: [], tier: "hubs" };
}

export function graphRetrieve(g: Graph, query: string, maxHops = 3): RetrievalResult {
  const seedIds = new Set(classicRetrieve(g, query).hits.map((h) => h.node.id));
  const idToNode = new Map(g.nodes.map((n) => [n.id, n] as const));
  const adj = new Map<string, { from: string; to: string; rel: string }[]>();
  for (const e of g.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.to)!.push(e);
  }
  const visited = new Set<string>(seedIds);
  const edgeKeys = new Set<string>();
  const edges: { from: string; to: string; rel: string }[] = [];
  let frontier = [...seedIds];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adj.get(id) || []) {
        const key = e.from + "|" + e.rel + "|" + e.to;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: e.from, to: e.to, rel: e.rel });
        }
        const other = e.from === id ? e.to : e.from;
        if (!visited.has(other)) {
          visited.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  const hits: RetrievalHit[] = [...visited].map((id) => ({ node: idToNode.get(id)!, reason: "traversed" }));
  return { hits, edges };
}

export function contrast(g: Graph, query: string) {
  return { classic: classicRetrieve(g, query), graph: graphRetrieve(g, query) };
}

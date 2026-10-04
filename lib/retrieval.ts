import type { Graph, GraphNode } from "./graph";

export interface RetrievalHit { node: GraphNode; reason: string; }
export interface RetrievalResult { hits: RetrievalHit[]; edges: { from: string; to: string; rel: string }[]; }

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "in", "into", "is", "it",
  "its", "me", "most", "my", "not", "of", "on", "or", "our", "should", "so",
  "that", "the", "their", "them", "they", "this", "to", "up", "was", "we",
  "were", "what", "which", "who", "will", "with", "would", "you", "your",
]);

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0 && !STOP.has(t));
}

export function classicRetrieve(g: Graph, query: string): RetrievalResult {
  const toks = tokens(query);
  const hits: RetrievalHit[] = [];
  for (const node of g.nodes) {
    const text = [node.label, node.name, node.desc, node.industry, node.type]
      .filter(Boolean).join(" ").toLowerCase();
    for (const t of toks) {
      if (text.includes(t)) {
        hits.push({ node, reason: "matched token '" + t + "'" });
        break;
      }
    }
  }
  return { hits, edges: [] };
}

export function graphRetrieve(g: Graph, query: string, maxHops = 3): RetrievalResult {
  const seedIds = new Set(classicRetrieve(g, query).hits.map((h) => h.node.id));
  const idToNode = new Map(g.nodes.map((n) => [n.id, n]));
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
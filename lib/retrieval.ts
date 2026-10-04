import type { Graph, GraphNode } from "./graph";

export interface RetrievalHit {
  node: GraphNode;
  reason: string;
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  edges: { from: string; to: string; rel: string }[];
}

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do", "does",
  "for", "from", "had", "has", "have", "how", "i", "in", "into", "is", "it",
  "its", "me", "most", "my", "not", "of", "on", "or", "our", "should", "so",
  "that", "the", "their", "them", "they", "this", "to", "up", "was", "we",
  "were", "what", "which", "who", "will", "with", "would", "you", "your",
]);

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

export function classicRetrieve(g: Graph, query: string): RetrievalResult {
  const toks = tokens(query);
  const hits: RetrievalHit[] = [];
  for (const node of g.nodes) {
    const text = [node.label, node.name, node.desc, node.industry, node.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    for (const t of toks) {
      if (text.includes(t)) {
        hits.push({ node, reason: "matched token '" + t + "'" });
        break;
      }
    }
  }
  return { hits, edges: [] };
}

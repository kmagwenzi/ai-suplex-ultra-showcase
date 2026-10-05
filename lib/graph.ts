import knowledgeBase from "../data/knowledge-base.json";
import revenue from "../data/revenue-graph.json";

export interface GraphNode {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface GraphEdge {
  from: string;
  to: string;
  rel: string;
}

export interface Graph {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function validateGraph(g: Graph): string[] {
  const errors: string[] = [];
  if (!g || typeof g.name !== "string" || g.name.length === 0) {
    errors.push("graph.name is required");
  }
  if (!Array.isArray(g.nodes)) {
    errors.push("graph.nodes must be an array");
    return errors;
  }
  if (!Array.isArray(g.edges)) {
    errors.push("graph.edges must be an array");
    return errors;
  }
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (!n.id) {
      errors.push("node missing id");
      continue;
    }
    if (ids.has(n.id)) {
      errors.push("duplicate node id: " + n.id);
    }
    ids.add(n.id);
    if (!n.type) {
      errors.push("node " + n.id + " missing type");
    }
  }
  for (const e of g.edges) {
    if (!e.from || !e.to || !e.rel) {
      errors.push("malformed edge: " + JSON.stringify(e));
      continue;
    }
    if (!ids.has(e.from)) {
      errors.push("edge from unknown node: " + e.from);
    }
    if (!ids.has(e.to)) {
      errors.push("edge to unknown node: " + e.to);
    }
  }
  return errors;
}

export function parseGraph(json: string): Graph {
  const g = JSON.parse(json) as Graph;
  const errors = validateGraph(g);
  if (errors.length > 0) {
    throw new Error("Invalid graph: " + errors.join("; "));
  }
  return g;
}

const GRAPHS: Record<"knowledge-base" | "revenue", Graph> = {
  "knowledge-base": knowledgeBase as Graph,
  revenue: revenue as Graph,
};

export function loadGraph(name: "knowledge-base" | "revenue"): Graph {
  const g = GRAPHS[name];
  const errors = validateGraph(g);
  if (errors.length > 0) {
    throw new Error("Invalid graph " + name + ": " + errors.join("; "));
  }
  return g;
}

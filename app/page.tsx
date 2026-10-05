"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

const SCENES = {
  "knowledge-base": {
    label: "Knowledge Base",
    queries: [
      { label: "7-7-7 rhythm", text: "What is the 7-7-7 rhythm and how is it applied in AI-Suplex?" },
      { label: "What is WQR?", text: "What is WQR, and what powers it?" },
      { label: "777 vs Ultra", text: "What is the difference between AI-Suplex 777 and Ultra?" },
    ],
    hint: "try “how does the memory compound?”",
  },
  revenue: {
    label: "Revenue",
    queries: [
      { label: "Who buys again?", text: "Which of my clients is most likely to buy again, and what exactly should I pitch?" },
      { label: "Who went quiet?", text: "Which client has gone quiet, and what is the follow-up?" },
      { label: "Revenue risk", text: "Where is my revenue concentrated — and what is the risk?" },
    ],
    hint: "try “which service should I productise next?”",
  },
} as const;

type Scene = keyof typeof SCENES;

interface VisNode { id: string; label: string; }
interface VisEdge { from: string; to: string; rel?: string; }

interface RunState {
  running: boolean;
  graphName: string;
  sourceA: string;
  sourceB: string;
  scoreA: number | null;
  scoreB: number | null;
  lesson: string;
  answer: string;
  error: string;
  nodesA: VisNode[];
  nodesB: VisNode[];
  edges: VisEdge[];
}

const initialState: RunState = {
  running: false,
  graphName: "",
  sourceA: "",
  sourceB: "",
  scoreA: null,
  scoreB: null,
  lesson: "",
  answer: "",
  error: "",
  nodesA: [],
  nodesB: [],
  edges: [],
};

interface StreamEvent {
  stage: string;
  data: Record<string, unknown>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Deterministic radial layout: seeds at the centre, each BFS hop a ring.
// No force simulation — the layout is a pure function of the retrieved sub-graph.
function radialLayout(
  nodes: VisNode[],
  edges: VisEdge[],
  seedIds: Set<string>,
  w: number,
  h: number,
): Map<string, { x: number; y: number }> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const id of seedIds) { depth.set(id, 0); queue.push(id); }
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const nb of adj.get(id) || []) {
      if (!depth.has(nb)) { depth.set(nb, d + 1); queue.push(nb); }
    }
  }
  let maxD = 0;
  for (const d of depth.values()) maxD = Math.max(maxD, d);
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, maxD + 1);

  const rings = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d)!.push(n.id);
  }
  const maxRing = Math.max(0, ...Array.from(rings.keys()));
  const cx = w / 2;
  const cy = h / 2;
  const r0 = 30;
  const avail = Math.min(w, h) / 2 - 26;
  const spacing = maxRing > 0 ? (avail - r0) / maxRing : 0;
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of Array.from(rings.entries())) {
    const r = maxRing === 0 ? 0 : r0 + spacing * d;
    const n = ids.length;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      pos.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
  }
  return pos;
}

function GraphPanel({ nodesA, nodesB, edges }: { nodesA: VisNode[]; nodesB: VisNode[]; edges: VisEdge[] }) {
  const w = 640;
  const h = 380;
  if (nodesA.length === 0 && nodesB.length === 0) {
    return <div className="flex items-center justify-center h-64 text-mut/50 text-sm">run a question to light the graph</div>;
  }
  const nodes = nodesB.length > 0 ? nodesB : nodesA;
  const seedIds = new Set(nodesA.map((n) => n.id));
  const pos = radialLayout(nodes, edges, seedIds, w, h);
  const aIds = new Set(nodesA.map((n) => n.id));
  return (
    <svg viewBox={"0 0 " + w + " " + h} className="w-full h-auto" role="img" aria-label="retrieved graph">
      {edges.map((e, i) => {
        const p1 = pos.get(e.from);
        const p2 = pos.get(e.to);
        if (!p1 || !p2) return null;
        return (
          <line key={"e" + i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#b8862e" strokeOpacity={0.55} strokeWidth={1.2}>
            {e.rel ? <title>{e.from + " → " + e.rel + " → " + e.to}</title> : null}
          </line>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const isSeed = aIds.has(n.id);
        const fill = isSeed ? "#94a3b8" : "#d4a94f";
        const r = isSeed ? 7 : 5;
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#080e1a" strokeWidth={1.5}>
              <title>{n.label}</title>
            </circle>
            <text x={p.x} y={p.y + r + 11} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {truncate(n.label, 14)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const [scene, setScene] = useState<Scene>("revenue");
  const [state, setState] = useState<RunState>(initialState);
  const [query, setQuery] = useState<string>("");
  const [freeText, setFreeText] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const controllerRef = useRef<AbortController | null>(null);

  function applyEvent(ev: StreamEvent) {
    setState((s) => {
      switch (ev.stage) {
        case "scene":
          return { ...s, graphName: String(ev.data.graph ?? ev.data.scene ?? "") };
        case "evidence_a":
          return {
            ...s,
            sourceA: String(ev.data.text ?? ""),
            nodesA: Array.isArray(ev.data.nodes) ? (ev.data.nodes as VisNode[]) : [],
          };
        case "evidence_b":
          return {
            ...s,
            sourceB: String(ev.data.text ?? ""),
            nodesB: Array.isArray(ev.data.nodes) ? (ev.data.nodes as VisNode[]) : [],
            edges: Array.isArray(ev.data.edges) ? (ev.data.edges as VisEdge[]) : [],
          };
        case "score_a":
          return { ...s, scoreA: Number(ev.data.score ?? 0) };
        case "score_b":
          return { ...s, scoreB: Number(ev.data.score ?? 0), answer: String(ev.data.answer ?? "") };
        case "lesson":
          return { ...s, lesson: String(ev.data.text ?? "") };
        case "error":
          return { ...s, error: String(ev.data.message ?? "unknown error") };
        default:
          return s;
      }
    });
  }

  async function run(q: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setQuery(q);
    setFreeText(false);
    setState({ ...initialState, running: true });

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, query: q }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            applyEvent(JSON.parse(trimmed) as StreamEvent);
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({ ...s, error: (err as Error).message }));
      }
    } finally {
      setState((s) => ({ ...s, running: false }));
    }
  }

  function switchScene(s: Scene) {
    setScene(s);
    setState(initialState);
    setQuery("");
    setDraft("");
    setFreeText(false);
  }

  const scoreText =
    state.scoreA !== null && state.scoreB !== null
      ? state.scoreA + " → " + state.scoreB
      : state.scoreA !== null
        ? state.scoreA + " → …"
        : "…";

  return (
    <main data-scene={scene} className="min-h-screen text-ink flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Deep Ultra 🦸</h1>
          <p className="mt-2 text-mut">
            Graph RAG retrieval · a self-scoring Gauntlet · a visible improvement, streamed live.
          </p>
        </header>

        <div className="flex justify-center gap-2 mb-6">
          {(Object.keys(SCENES) as Scene[]).map((s) => (
            <button
              key={s}
              onClick={() => switchScene(s)}
              disabled={state.running}
              className={
                scene === s
                  ? "px-4 py-2 rounded-full bg-gold text-navy-950 font-semibold"
                  : "px-4 py-2 rounded-full border border-white/10 text-mut hover:border-gold-hi/50"
              }
            >
              {SCENES[s].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {SCENES[scene].queries.map((q) => (
            <button
              key={q.label}
              onClick={() => run(q.text)}
              disabled={state.running}
              className="px-3 py-1.5 rounded-full text-sm border border-white/10 text-mut hover:border-gold hover:text-gold-hi"
            >
              {q.label}
            </button>
          ))}
          <button
            onClick={() => setFreeText(!freeText)}
            disabled={state.running}
            className={
              freeText
                ? "px-3 py-1.5 rounded-full text-sm bg-gold text-navy-950 font-semibold"
                : "px-3 py-1.5 rounded-full text-sm border border-white/10 text-mut hover:border-gold hover:text-gold-hi"
            }
          >
            Something else
          </button>
        </div>

        {freeText && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) run(draft.trim());
            }}
            className="mb-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={SCENES[scene].hint}
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-navy-800/60 border border-white/10 text-ink placeholder-mut focus:outline-none focus:border-gold"
            />
          </form>
        )}

        <p className="text-center text-mut mb-1 italic">
          {query ? "“" + query + "”" : "pick a question, or ask your own"}
        </p>
        <p className="text-center text-xs text-mut/60 mb-6">
          {state.graphName ? "graph: " + state.graphName : "two curated graphs · one engine"}
        </p>

        {state.error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">{state.error}</div>
        )}

        <div className="mb-6 rounded-xl border border-white/10 bg-navy-800/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-gold-hi">Retrieval Graph</div>
            <div className="flex items-center gap-3 text-[10px] text-mut">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#94a3b8] inline-block" /> matched (A)</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d4a94f] inline-block" /> graph-reached (B)</span>
            </div>
          </div>
          <GraphPanel nodesA={state.nodesA} nodesB={state.nodesB} edges={state.edges} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card title="Source">
            {state.sourceA || state.sourceB ? (
              <div className="space-y-2 text-xs text-mut font-mono break-words">
                <div><span className="text-mut/60">A · keyword:</span> {state.sourceA || "…"}</div>
                <div><span className="text-gold-hi">B · graph:</span> {state.sourceB || "…"}</div>
              </div>
            ) : (
              <Waiting />
            )}
          </Card>

          <Card title="Score">
            {state.scoreB !== null ? (
              <div>
                <div className="text-3xl font-bold text-gold-hi">{scoreText}</div>
                <div className="text-xs text-mut mt-1">out of 10 · the retry closes the gap</div>
              </div>
            ) : (
              <Waiting />
            )}
          </Card>

          <Card title="Lesson">
            {state.lesson ? <p className="text-sm text-ink/90">{state.lesson}</p> : <Waiting />}
          </Card>

          <Card title={scene === "revenue" ? "🧭 Opportunity Mapper" : "Answer"}>
            {state.answer ? (
              <div>
                <p className="text-sm text-ink whitespace-pre-wrap">{state.answer}</p>
                {scene === "revenue" && (
                  <p className="text-xs text-gold-hi mt-3 pt-2 border-t border-white/10">
                    chain → price band → next action · the same traversal that answers a question also finds the next sale
                  </p>
                )}
              </div>
            ) : (
              <Waiting />
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy-800/50 p-5 min-h-44">
      <div className="text-xs uppercase tracking-wider text-gold-hi mb-3">{title}</div>
      {children}
    </div>
  );
}

function Waiting() {
  return <p className="text-sm text-mut/60">…</p>;
}

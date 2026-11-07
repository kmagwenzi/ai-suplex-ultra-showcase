"use client";

import { useEffect, useRef, useState } from "react";

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
    return (
      <div className="flex h-[300px] items-center justify-center">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-mut/40">
          run a question to light the graph
        </span>
      </div>
    );
  }
  const nodes = nodesB.length > 0 ? nodesB : nodesA;
  const seedIds = new Set(nodesA.map((n) => n.id));
  const pos = radialLayout(nodes, edges, seedIds, w, h);
  const aIds = new Set(nodesA.map((n) => n.id));
  return (
    <svg
      viewBox={"0 0 " + w + " " + h}
      className="w-full h-auto"
      role="img"
      aria-label="retrieved graph"
      preserveAspectRatio="xMidYMid meet"
    >
      <g>
        {edges.map((e, i) => {
          const p1 = pos.get(e.from);
          const p2 = pos.get(e.to);
          if (!p1 || !p2) return null;
          return (
            <line
              key={"e" + i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              pathLength={1}
              stroke="#b8862e"
              strokeOpacity={0.5}
              strokeWidth={1.1}
              strokeDasharray={1}
              className="edge-draw"
              style={{ animationDelay: Math.min(i * 18, 500) + "ms" }}
            >
              {e.rel ? <title>{e.from + " → " + e.rel + " → " + e.to}</title> : null}
            </line>
          );
        })}
      </g>
      {nodes.map((n, i) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const isSeed = aIds.has(n.id);
        const fill = isSeed ? "#94a3b8" : "#d4a94f";
        const r = isSeed ? 6.5 : 4.5;
        return (
          <g key={n.id} className="node-in" style={{ animationDelay: Math.min(i * 22, 600) + "ms" }}>
            <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#080e1a" strokeWidth={1.5}>
              <title>{n.label}</title>
            </circle>
            <text
              x={p.x}
              y={p.y + r + 10}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
              className="font-mono"
            >
              {truncate(n.label, 16)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Presentation-only: the score counts up when it lands. Respects reduced motion.
function useCountUp(target: number | null): number | null {
  const [value, setValue] = useState<number | null>(target);
  useEffect(() => {
    if (target === null) { setValue(null); return; }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const dur = 520;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round((from + (target - from) * eased) * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function Home() {
  const [scene, setScene] = useState<Scene>("revenue");
  const [state, setState] = useState<RunState>(initialState);
  const [query, setQuery] = useState<string>("");
  const [freeText, setFreeText] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const controllerRef = useRef<AbortController | null>(null);
  const scoreA = useCountUp(state.scoreA);
  const scoreB = useCountUp(state.scoreB);

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

  const hasRun = state.scoreA !== null || state.scoreB !== null;
  const gap =
    state.scoreA !== null && state.scoreB !== null ? state.scoreB - state.scoreA : null;

  return (
    <main data-scene={scene} className="min-h-screen text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-10 md:px-10">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="mb-14 max-w-2xl">
          <h1 className="font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] md:text-[3.4rem]">
            The same question,
            <br />
            answered twice.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mut">
            Keyword retrieval scores A. Graph retrieval scores B.{" "}
            <span className="text-ink">The gap is the product.</span>
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">

          {/* ── Control rail ───────────────────────────────────── */}
          <aside className="flex flex-col gap-1.5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mut/60">Scene</div>
            {(Object.keys(SCENES) as Scene[]).map((s) => (
              <button
                key={s}
                onClick={() => switchScene(s)}
                disabled={state.running}
                className={
                  "border-l-2 py-1.5 pl-3 text-left text-[13px] transition-colors disabled:opacity-50 " +
                  (scene === s
                    ? "border-gold bg-gold/[0.06] text-ink"
                    : "border-white/10 text-mut hover:border-white/25 hover:text-ink")
                }
              >
                {SCENES[s].label}
              </button>
            ))}

            <div className="mt-6 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mut/60">Questions</div>
            {SCENES[scene].queries.map((q) => (
              <button
                key={q.label}
                onClick={() => run(q.text)}
                disabled={state.running}
                className={
                  "border-l-2 py-1.5 pl-3 text-left text-[13px] transition-colors disabled:opacity-40 " +
                  (query === q.text
                    ? "border-gold-hi/70 text-gold-hi"
                    : "border-white/10 text-mut hover:border-white/25 hover:text-ink")
                }
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={() => setFreeText(!freeText)}
              disabled={state.running}
              className={
                "mt-1 border-l-2 py-1.5 pl-3 text-left text-[13px] transition-colors disabled:opacity-40 " +
                (freeText
                  ? "border-gold-hi/70 text-gold-hi"
                  : "border-white/10 text-mut hover:border-white/25 hover:text-ink")
              }
            >
              Something else
            </button>

            {freeText && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) run(draft.trim());
                }}
                className="mt-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={SCENES[scene].hint}
                  autoFocus
                  className="w-full border border-white/12 bg-transparent px-3 py-2 text-[13px] text-ink placeholder:text-mut/40 focus:border-gold focus:outline-none"
                />
              </form>
            )}

            <div className="mt-6 font-mono text-[10px] leading-relaxed text-mut/40">
              {state.running ? "streaming…" : state.graphName ? "graph: " + state.graphName : "two curated graphs · one engine"}
            </div>
          </aside>

          {/* ── Instrument ─────────────────────────────────────── */}
          <section className="min-w-0">

            {/* Prompt line */}
            <div className="mb-6 flex min-h-[26px] items-baseline gap-3 border-b border-white/[0.07] pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mut/50">Q</span>
              <p className={"font-serif text-[17px] leading-snug " + (query ? "text-ink" : "text-mut/50")}>
                {query || "pick a question, or ask your own"}
              </p>
            </div>

            {state.error && (
              <div className="mb-6 border border-red-900/50 bg-red-950/30 px-4 py-3 font-mono text-[12px] text-red-300">
                {state.error}
              </div>
            )}

            {/* Graph band — full bleed, hairline */}
            <div className="relative">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mut/50">
                  Retrieval graph
                </span>
                <span className="flex items-center gap-4 font-mono text-[10px] text-mut/60">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#94a3b8]" />
                    matched · A
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#d4a94f]" />
                    graph-reached · B
                  </span>
                </span>
              </div>
              <div className="border-y border-white/[0.07] py-2">
                <GraphPanel nodesA={state.nodesA} nodesB={state.nodesB} edges={state.edges} />
              </div>
            </div>

            {/* Asymmetric verdict: answer 2fr · score + lesson 1fr */}
            <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-10">

              <div className="min-w-0">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mut/50">
                  {scene === "revenue" ? "Opportunity · answer" : "Answer"}
                </div>
                {state.answer ? (
                  <p key={state.answer} className="reveal whitespace-pre-wrap text-[15px] leading-relaxed text-ink/85">
                    {state.answer}
                  </p>
                ) : (
                  <p className="font-mono text-[13px] text-mut/35">…</p>
                )}

                {(state.sourceA || state.sourceB) && (
                  <div className="mt-6 space-y-2 border-t border-white/[0.07] pt-4 font-mono text-[11px] leading-relaxed break-words">
                    <div className="text-mut/60">
                      <span className="text-mut/40">A · keyword</span>{" "}
                      <span className="text-mut/80">{state.sourceA || "—"}</span>
                    </div>
                    <div className="text-mut/60">
                      <span className="text-gold-hi/70">B · graph</span>{" "}
                      <span className="text-mut/80">{state.sourceB || "—"}</span>
                    </div>
                  </div>
                )}

                {scene === "revenue" && state.answer && (
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-gold-hi/60">
                    chain → price band → next action
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-7">
                {/* Score — the hero object */}
                <div>
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mut/50">Score</div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[13px] text-mut/50">
                      {scoreA !== null ? scoreA : "–"}
                    </span>
                    <span className="font-mono text-[13px] text-mut/30">→</span>
                    <span className="font-serif text-[3.6rem] leading-none tracking-tight text-gold-hi">
                      {scoreB !== null ? (Number.isInteger(scoreB) ? scoreB : scoreB.toFixed(1)) : "–"}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mut/45">
                    out of 10 · deterministic rubric
                  </div>
                  {gap !== null && gap > 0 && (
                    <div className="mt-2 font-mono text-[11px] text-gold-hi">
                      +{gap} from the edges
                    </div>
                  )}
                </div>

                {/* Lesson */}
                <div>
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mut/50">Lesson</div>
                  {state.lesson ? (
                    <p key={state.lesson} className="reveal-2 text-[13px] leading-relaxed text-mut">
                      {state.lesson}
                    </p>
                  ) : (
                    <p className="font-mono text-[13px] text-mut/35">…</p>
                  )}
                </div>
              </div>
            </div>

            {!hasRun && !state.running && (
              <p className="mt-10 border-t border-white/[0.07] pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-mut/35">
                deterministic-first · renders with no key · the model is optional
              </p>
            )}
          </section>
        </div>

        {/* ── Footer mark ────────────────────────────────────────── */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-mut/40">
          <span>🦸 Deep Ultra · AI-Suplex Ultra</span>
          <span>graph rag · self-scoring gauntlet</span>
        </footer>
      </div>
    </main>
  );
}

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
};

interface StreamEvent {
  stage: string;
  data: Record<string, unknown>;
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
          return { ...s, sourceA: String(ev.data.text ?? "") };
        case "evidence_b":
          return { ...s, sourceB: String(ev.data.text ?? "") };
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

"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

const SCENES = {
  "knowledge-base": {
    label: "Knowledge Base",
    question: "What is WQR, and what powers it?",
  },
  revenue: {
    label: "Revenue",
    question: "Which of my clients is most likely to buy again, and what exactly should I pitch?",
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

  async function run() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...initialState, running: true });

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, query: SCENES[scene].question }),
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
  }

  const scoreText =
    state.scoreA !== null && state.scoreB !== null
      ? state.scoreA + " → " + state.scoreB
      : state.scoreA !== null
        ? state.scoreA + " → …"
        : "…";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Deep Ultra 🦸</h1>
          <p className="mt-2 text-zinc-400">
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
                  ? "px-4 py-2 rounded-full bg-amber-500 text-black font-semibold"
                  : "px-4 py-2 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }
            >
              {SCENES[s].label}
            </button>
          ))}
        </div>

        <p className="text-center text-zinc-300 mb-1 italic">“{SCENES[scene].question}”</p>
        <p className="text-center text-xs text-zinc-600 mb-6">
          {state.graphName ? "graph: " + state.graphName : "two curated graphs · one engine"}
        </p>

        <div className="text-center mb-8">
          <button
            onClick={run}
            disabled={state.running}
            className="px-6 py-3 rounded-lg bg-zinc-100 text-black font-semibold disabled:opacity-50"
          >
            {state.running ? "Running the Gauntlet…" : "Run the Gauntlet"}
          </button>
        </div>

        {state.error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">{state.error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card title="Source">
            {state.sourceA || state.sourceB ? (
              <div className="space-y-2 text-xs text-zinc-400 font-mono break-words">
                <div><span className="text-zinc-500">A · keyword:</span> {state.sourceA || "…"}</div>
                <div><span className="text-amber-500">B · graph:</span> {state.sourceB || "…"}</div>
              </div>
            ) : (
              <Waiting />
            )}
          </Card>

          <Card title="Score">
            {state.scoreB !== null ? (
              <div>
                <div className="text-3xl font-bold text-amber-400">{scoreText}</div>
                <div className="text-xs text-zinc-500 mt-1">out of 10 · the retry closes the gap</div>
              </div>
            ) : (
              <Waiting />
            )}
          </Card>

          <Card title="Lesson">
            {state.lesson ? <p className="text-sm text-zinc-300">{state.lesson}</p> : <Waiting />}
          </Card>

          <Card title="Answer">
            {state.answer ? <p className="text-sm text-zinc-100 whitespace-pre-wrap">{state.answer}</p> : <Waiting />}
          </Card>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 min-h-44">
      <div className="text-xs uppercase tracking-wider text-amber-500 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Waiting() {
  return <p className="text-sm text-zinc-600">…</p>;
}

# AI-Suplex Ultra — Showcase

**The same question, answered twice. The first answer is retrieved by keyword. The second is retrieved by walking a knowledge graph. Both are scored — live, in public, against a rubric the model cannot talk its way around.**

[![Tests](https://img.shields.io/badge/tests-25%20passing-brightgreen)](#running-it)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

---

## What you are looking at

Pick a scene, tap a question chip (or type your own), and four cards fill in as the run streams:

| Card | What it shows |
| --- | --- |
| **Source** | The evidence each stage was given. Stage A gets nodes. Stage B gets nodes **and edges**. |
| **Score** | `A → B` out of 10, from a deterministic rubric. |
| **Lesson** | The named failures from stage A, turned into an instruction. |
| **Answer** | The final answer, written from the graph evidence. |

The interesting number is not the score. It is the **gap**.

---

## The mechanism

The model is identical in both stages. The question is identical. **Only the evidence changes.**

**Stage A — lexical retrieval (`classicRetrieve`)**
Query tokens are matched against each node's text. It returns matching nodes and **no edges at all**. This is a search box.

**Stage B — graph traversal (`graphRetrieve`)**
The same seed nodes, then a breadth-first walk up to **3 hops**, returning the nodes *and the relationships between them* — `depends_on`, `powers`, `feeds`, `uses_service`, `delivered_to`, `adjacent`.

A keyword retriever finds the strings you typed. A graph retriever finds the things you did not know to type.

---

## The rubric — and the one invariant that makes this honest

| Dimension | Points | Awarded when |
| --- | --- | --- |
| **grounded** | 0–3 | cites 3+ entities from the evidence (1–2 scores 2; none scores 0) |
| **complete** | 0–3 | names a relationship **present in that stage's own edge list** |
| **actionable** | 0–2 | names a concrete next action |
| **specific** | 0–2 | cites a real figure or price band |
| | **10** | |

> **The honesty invariant.** Each stage is scored against *the evidence that stage was actually given* — not against the whole graph.
>
> Stage A receives zero edges. So a Stage A answer that invents a relationship **cannot** be credited for `complete`. Without this, the demo would reward eloquence, the score would be theatre, and the gap would be meaningless.
>
> This is enforced in code and covered by tests: a stage with no edges scores 0 on `complete`.

---

## The loop

```
evidence A ──▶ answer A ──▶ score A ──▶ lesson ──┐
                                                  │
                                                  ▼
evidence B ──▶ answer B ──▶ score B        (lesson injected
                                             into the retry prompt)
```

Failures are not just displayed — they are **distilled into an instruction** (`distillLesson`) and fed back into the retry prompt:

> *"A previous attempt scored 5/10. Address these failures: 1. answer cites fewer than three entities from the evidence. 2. answer does not use a relationship from the evidence graph."*

The run streams over `application/x-ndjson`: `scene → evidence_a → score_a → lesson → evidence_b → score_b`. Every card on screen is a real stage, not an animation.

---

## Sample runs (observed)

| Scene | Stage A | Stage B |
| --- | --- | --- |
| **Revenue** — *"Which of my clients is most likely to buy again, and what exactly should I pitch?"* | 5/10 | **10/10** |
| **Knowledge Base** — *"What is WQR, and what powers it?"* | 5/10 | **10/10** |

Observed on `deepseek-flash` at `effort: low`. **The absolute numbers are model-dependent; the mechanism is not.** Stage A's ceiling is structural: with no edges in its evidence, `complete` is unwinnable.

---

## Architecture

```
app/page.tsx            client shell — scene switch, NDJSON stream reader, four cards
app/api/run/route.ts    streaming endpoint — emits the scene, then every stage as it happens
lib/graph.ts            loads + validates curated graphs (static JSON imports, bundle-safe)
lib/retrieval.ts        classicRetrieve (lexical) · graphRetrieve (BFS, maxHops = 3)
lib/rubric.ts           scoreAnswer (10 pts, stage-scoped) + distillLesson
lib/gauntlet.ts         orchestrates A → lesson → B and streams each stage
lib/model.ts            provider chain — a primary, plus an automatic fallback
lib/fallback.ts         recorded-run replay, for a deterministic offline demo
data/*.json             the two curated graphs
```

### The graphs

| Graph | Nodes | Edges | Node types | Relationships |
| --- | --- | --- | --- | --- |
| **Knowledge Base** | 36 | 45 | product · module · tool · concept · workflow · artifact · goal · framework · persona | `built_on` · `uses` · `applies` · `ships_as` · `part_of` · `powers` · `feeds` · `depends_on` · `implements` |
| **Revenue** | 22 | 23 | client · project · service · skill | `delivered_to` · `uses_service` · `uses_skill` · `adjacent` |

> **The revenue graph is synthetic sample data.** Five invented clients and five invented projects, authored to demonstrate cross-sell traversal. No real client, contract, or price is represented anywhere in this repository.

> **🧭 Opportunity Mapper.** The Revenue scene *is* the Opportunity Mapper — the same traversal that answers a question also finds the next sale (`chain → price band → next action`). Zero extra engine; just a name and a badge.

---

## Running it

```bash
npm install
cp .env.example .env.local     # add one key (below)
npm run dev                    # http://localhost:3000
```

```bash
npm test           # 25 tests — retrieval (incl. tiered fallback), rubric, gauntlet, fallback, graph validation
npm run typecheck  # tsc --noEmit, strict
```

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `MODEL_PROVIDER` | `gemini` | `gemini` or `deepseek` — which answers **first** |
| `GEMINI_API_KEY` | — | free tier at aistudio.google.com/apikey |
| `MODEL` | `gemini-3.6-flash` | Gemini model id |
| `DEEPSEEK_API_KEY` | — | platform.deepseek.com → API keys |
| `DEEPSEEK_MODEL` | `deepseek-flash` | `deepseek-chat` does not exist — the catalogue is `deepseek-flash` / `deepseek-v4-pro` |
| `DEEPSEEK_EFFORT` | `low` | `low` · `high` · `max` · `off`. Low minimises reasoning tokens so answers are not truncated |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible |

**The provider chain is real.** `appModel()` tries the primary and falls through to the other provider on failure — a spent quota degrades instead of breaking. If both fail, you get an error naming both. DeepSeek is reached over the OpenAI-compatible `/chat/completions` shape.

---

## Stack

**Next.js 16** (App Router, Turbopack) · **React 19** · **Tailwind v4** · **TypeScript** (strict) · **Vitest 3**

No vector database. No framework for graph traversal. The retrieval and the rubric are ~150 lines of plain TypeScript you can read in a sitting — which is the point.

---

## Why this repository exists

This is the **showcase** for [AI-Suplex](https://github.com/kmagwenzi/ai-suplex) — a file-first, self-improving execution framework for AI agents, built around a 7-week cycle and a three-layer memory stack.

The framework is the product. **This is one idea from it, extracted and made falsifiable**: structured retrieval beats lexical retrieval on the same question, and the improvement can be *scored* rather than asserted.

It is deliberately small and complete. A visitor can read every line, run it, and watch the number move — or watch it fail honestly.

---

## Privacy

Every graph here was authored for the demonstration. No vault export, no session transcript, no client record, and no personal data is published in this repository. The revenue dataset is synthetic and labelled as such.

---

## License

MIT — see [LICENSE](LICENSE).

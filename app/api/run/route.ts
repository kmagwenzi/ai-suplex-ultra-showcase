import { NextRequest } from "next/server";
import { loadGraph } from "../../../lib/graph";
import { classicRetrieve, graphRetrieve } from "../../../lib/retrieval";
import { runGauntlet } from "../../../lib/gauntlet";
import { geminiModel } from "../../../lib/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { scene?: string; query?: string };
  try {
    body = (await req.json()) as { scene?: string; query?: string };
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  const scene = body.scene === "technical" ? "technical" : "revenue";
  const query = body.query || "which client should I upsell";
  const g = loadGraph(scene);
  const model = geminiModel();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (stage: string, data: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify({ stage, data }) + "\n"));
      };
      try {
        send("scene", { scene, graph: g.name, nodes: g.nodes.length, edges: g.edges.length });
        const result = await runGauntlet(query, g, model, { a: classicRetrieve, b: graphRetrieve }, send);
        send("done", { a: result.a.score, b: result.b.score });
      } catch (err) {
        send("error", { message: (err as Error).message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

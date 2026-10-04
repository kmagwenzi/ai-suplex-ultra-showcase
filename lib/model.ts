import type { Model } from "./gauntlet";

export function geminiModel(): Model {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId = process.env.MODEL || "gemini-3.6-flash";
  return {
    generate: async (prompt: string): Promise<string> => {
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set (create .env.local)");
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent?key=" + apiKey;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error("Gemini HTTP " + res.status + ": " + body.slice(0, 300));
      }
      const json = (await res.json()) as {
        candidates?: Array<{
          finishReason?: string;
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const cand = json.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? "").join("");
      if (!text) return "(no text returned; finishReason=" + (cand?.finishReason ?? "unknown") + ")";
      return text;
    },
  };
}

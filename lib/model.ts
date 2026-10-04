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
          generationConfig: { maxOutputTokens: 400 },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error("Gemini HTTP " + res.status + ": " + body.slice(0, 200));
      }
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
  };
}

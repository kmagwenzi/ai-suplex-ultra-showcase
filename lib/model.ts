import type { Model } from "./gauntlet";

interface Provider {
  name: string;
  configured: boolean;
  generate: (prompt: string) => Promise<string>;
}

function geminiProvider(): Provider {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId = process.env.MODEL || "gemini-3.6-flash";
  return {
    name: "gemini:" + modelId,
    configured: Boolean(apiKey),
    generate: async (prompt: string): Promise<string> => {
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent?key=" + apiKey;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error("Gemini HTTP " + res.status + ": " + body.slice(0, 180));
      }
      const json = (await res.json()) as {
        candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
      };
      const cand = json.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text) throw new Error("Gemini returned no text (finishReason=" + (cand?.finishReason ?? "unknown") + ")");
      return text;
    },
  };
}

function deepseekProvider(): Provider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  // The catalogue moved: deepseek-chat is gone. Available: deepseek-flash, deepseek-v4-pro.
  const modelId = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  // effort: low | high | max (default high). 'low' minimises reasoning tokens so the
  // answer is not truncated by thinking. Set DEEPSEEK_EFFORT=off to omit the field.
  const effort = process.env.DEEPSEEK_EFFORT || "low";
  return {
    name: "deepseek:" + modelId,
    configured: Boolean(apiKey),
    generate: async (prompt: string): Promise<string> => {
      if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
      const payload: Record<string, unknown> = {
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.2,
        stream: false,
      };
      if (effort && effort !== "off") payload.effort = effort;
      const res = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error("DeepSeek HTTP " + res.status + ": " + body.slice(0, 200));
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("DeepSeek returned no text");
      return text;
    },
  };
}

export function appModel(): Model {
  const order =
    (process.env.MODEL_PROVIDER || "gemini") === "deepseek"
      ? [deepseekProvider(), geminiProvider()]
      : [geminiProvider(), deepseekProvider()];

  return {
    generate: async (prompt: string): Promise<string> => {
      const errors: string[] = [];
      for (const p of order) {
        if (!p.configured) {
          errors.push(p.name + ": not configured");
          continue;
        }
        try {
          return await p.generate(prompt);
        } catch (err) {
          errors.push(p.name + ": " + (err as Error).message);
        }
      }
      throw new Error("All model providers failed — " + errors.join(" | "));
    },
  };
}

export function geminiModel(): Model {
  return appModel();
}

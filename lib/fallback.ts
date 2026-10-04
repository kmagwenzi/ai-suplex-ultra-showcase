import type { GauntletResult } from "./gauntlet";

export interface FallbackResult extends GauntletResult {
  replay?: boolean;
}

export async function withFallback(
  run: () => Promise<GauntletResult>,
  recorded: GauntletResult,
): Promise<FallbackResult> {
  try {
    return await run();
  } catch {
    return { ...recorded, replay: true };
  }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "...";
}

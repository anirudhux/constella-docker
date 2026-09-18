import type { RawInput } from "../../types/graph";

export function parseJson(text: string, filename?: string): RawInput {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    throw new Error(`Could not parse JSON: ${msg}`);
  }
  if (json === null || typeof json !== "object") {
    throw new Error("Expected a JSON object or array at the top level.");
  }
  return { kind: "json", format: "json", filename, json };
}

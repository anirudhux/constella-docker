import Papa from "papaparse";
import type { RawInput, TableData } from "../../types/graph";

/** Coerce any parsed cell to a trimmed string. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function tableFromRows(
  headers: string[],
  rawRows: Record<string, unknown>[],
): TableData {
  const cleanHeaders = headers.map((h) => h.trim()).filter(Boolean);
  const rows = rawRows.map((raw) => {
    const row: Record<string, string> = {};
    for (const h of cleanHeaders) row[h] = cell(raw[h]);
    return row;
  });
  return { headers: cleanHeaders, rows };
}

export function parseCsv(text: string, filename?: string): RawInput {
  const result = Papa.parse<Record<string, unknown>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  if (headers.length === 0) {
    throw new Error("No columns found. Make sure the first row contains headers.");
  }

  const table = tableFromRows(headers, result.data ?? []);
  // Drop fully-empty rows that survived parsing.
  table.rows = table.rows.filter((r) => Object.values(r).some((v) => v !== ""));

  if (table.rows.length === 0) {
    throw new Error("No data rows found beneath the header row.");
  }

  return { kind: "spreadsheet", format: "csv", filename, table };
}

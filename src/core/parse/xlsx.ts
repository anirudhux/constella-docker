import type { RawInput } from "../../types/graph";
import { tableFromRows } from "./csv";

/**
 * Parse the first sheet of an .xlsx workbook (build plan §4.2 — first sheet,
 * first row as headers). SheetJS is lazy-imported so it only loads when a
 * spreadsheet is actually opened.
 */
export async function parseXlsx(
  buffer: ArrayBuffer,
  filename?: string,
): Promise<RawInput> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("The workbook has no sheets.");
  const sheet = wb.Sheets[firstSheetName];

  // header:1 → array-of-arrays, preserving column order.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  if (matrix.length === 0) throw new Error("The first sheet is empty.");

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? "").trim());
  if (headers.filter(Boolean).length === 0) {
    throw new Error("No header row found in the first sheet.");
  }

  const rawRows = matrix.slice(1).map((arr) => {
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = (arr as unknown[])[i];
    });
    return row;
  });

  const table = tableFromRows(headers, rawRows);
  table.rows = table.rows.filter((r) => Object.values(r).some((v) => v !== ""));
  if (table.rows.length === 0) {
    throw new Error("No data rows found beneath the header row.");
  }

  return { kind: "spreadsheet", format: "xlsx", filename, table };
}

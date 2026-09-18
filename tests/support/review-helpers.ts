// Shared upload helpers for the import-flow step files.
// (The old Review-gate helpers were removed with the Review step — an import
// now renders, asks the user to pick, or lands on the flat screen.)
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ConstellaWorld } from "./world";

export const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

/** Upload a fixture from the landing page. Does NOT wait for a destination —
 *  the caller asserts where it lands (graph / pick / flat). */
export async function uploadFixture(
  world: ConstellaWorld,
  file = "hierarchy-ambiguous.csv",
): Promise<void> {
  await world.open("/");
  await world.page
    .locator('input[type="file"]')
    .setInputFiles(path.join(FIXTURES, file));
}

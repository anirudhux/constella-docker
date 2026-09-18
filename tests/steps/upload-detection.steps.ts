import { When } from "@cucumber/cucumber";
import path from "node:path";
import type { ConstellaWorld } from "../support/world";
import { FIXTURES, uploadFixture } from "../support/review-helpers";

When(
  "I upload a CSV file with hierarchy columns and metadata columns",
  async function (this: ConstellaWorld) {
    // A clear, high-confidence hierarchy (>= the coverage cut-off) → renders.
    await uploadFixture(this, "hierarchy.csv");
  },
);

// Upload any named fixture from the landing page (destination asserted by the caller).
When(
  "I upload the {string} fixture",
  async function (this: ConstellaWorld, file: string) {
    await this.page
      .locator('input[type="file"]')
      .setInputFiles(path.join(FIXTURES, file));
  },
);

#!/usr/bin/env node
// Test-bench coverage dashboard generator. Zero dependencies.
//
//   node tests/coverage-report.mjs   (or: npm run test:coverage)
//
// Parses tests/features/**/*.feature for the authored scenario inventory,
// classifies each scenario by its tags, and — if tests/_report/cucumber-report.json
// is present (written by the last `npm run test:net`) — overlays live pass/fail.
// Writes a self-contained tests/_report/coverage.html you can open directly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_DIR = path.join(ROOT, "tests/features");
const REPORT_DIR = path.join(ROOT, "tests/_report");
const JSON_REPORT = path.join(REPORT_DIR, "cucumber-report.json");
const OUT = path.join(REPORT_DIR, "coverage.html");

// The full source spec (Constella_Gherkin_Test_Bench.md) holds this many scenarios.
const BENCH_TOTAL = 103;

/* ----------------------------- feature parsing ---------------------------- */

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".feature")) out.push(p);
  }
  return out;
}

const tagsOf = (line) => line.trim().split(/\s+/).filter((t) => t.startsWith("@"));

function parseFeature(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let featureName = path.basename(file);
  let featureTags = [];
  let pending = [];
  const scenarios = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("@")) {
      pending.push(...tagsOf(line));
      continue;
    }
    if (line.startsWith("Feature:")) {
      featureName = line.slice("Feature:".length).trim();
      featureTags = pending;
      pending = [];
      continue;
    }
    const m = line.match(/^(Scenario Outline|Scenario):\s*(.*)$/);
    if (m) {
      const tags = [...new Set([...featureTags, ...pending])];
      scenarios.push({ name: m[2].trim(), outline: m[1] === "Scenario Outline", tags });
      pending = [];
      continue;
    }
    // Any other content line (Background:, Given/When/Then, Examples:, |…|, etc.)
    pending = [];
  }
  return { file, name: featureName, scenarios };
}

function classify(tags) {
  if (tags.includes("@wip")) return "wip";
  if (tags.includes("@expected")) return "expected";
  if ((tags.includes("@smoke") || tags.includes("@regression"))) return "automated";
  return "ungated";
}

/* ------------------------------ results overlay --------------------------- */

function loadOutcomes() {
  if (!fs.existsSync(JSON_REPORT)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(JSON_REPORT, "utf8"));
  } catch {
    return null;
  }
  const byName = new Map();
  for (const feat of data) {
    for (const el of feat.elements ?? []) {
      if (el.type && el.type !== "scenario") continue;
      const steps = (el.steps ?? []).filter((s) => s.result);
      if (!steps.length) continue;
      const statuses = steps.map((s) => s.result.status);
      const outcome = statuses.every((s) => s === "passed")
        ? "passed"
        : statuses.some((s) => s === "failed")
          ? "failed"
          : "other";
      // Last write wins; outline rows share a name — fold to worst case.
      const prev = byName.get(el.name);
      if (prev === "failed") continue;
      byName.set(el.name, outcome === "failed" ? "failed" : prev ?? outcome);
    }
  }
  return byName;
}

/* -------------------------------- assemble -------------------------------- */

const featureFiles = walk(FEATURES_DIR).sort();
const outcomes = loadOutcomes();
const features = featureFiles.map(parseFeature).map((f) => {
  const scenarios = f.scenarios.map((s) => ({
    ...s,
    status: classify(s.tags),
    live: outcomes ? outcomes.get(s.name) ?? "notrun" : "notrun",
  }));
  const count = (st) => scenarios.filter((s) => s.status === st).length;
  const impact = scenarios.some((s) => s.tags.includes("@smoke"))
    ? "Critical"
    : scenarios.some((s) => s.tags.includes("@regression"))
      ? "High"
      : "Standard";
  const automated = scenarios.filter((s) => s.status === "automated");
  return {
    name: f.name,
    file: path.relative(ROOT, f.file),
    scenarios,
    total: scenarios.length,
    automated: count("automated"),
    wip: count("wip"),
    expected: count("expected"),
    ungated: count("ungated"),
    passed: automated.filter((s) => s.live === "passed").length,
    failed: automated.filter((s) => s.live === "failed").length,
    impact,
  };
});

const totals = features.reduce(
  (a, f) => ({
    total: a.total + f.total,
    automated: a.automated + f.automated,
    wip: a.wip + f.wip,
    expected: a.expected + f.expected,
    ungated: a.ungated + f.ungated,
    passed: a.passed + f.passed,
    failed: a.failed + f.failed,
  }),
  { total: 0, automated: 0, wip: 0, expected: 0, ungated: 0, passed: 0, failed: 0 },
);

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const coveragePct = pct(totals.automated, totals.total);
const passPct = pct(totals.passed, totals.automated);
const benchPct = pct(totals.total, BENCH_TOTAL);
const hasResults = !!outcomes;

/* --------------------------------- render --------------------------------- */

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const STATUS_LABEL = { automated: "Automated", wip: "WIP", expected: "Expected", ungated: "Ungated" };
const LIVE_LABEL = { passed: "Passed", failed: "Failed", notrun: "Not run", other: "Skipped" };

const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;

function bar(pctVal, cls = "ok") {
  return `<div class="bar"><div class="bar__fill ${cls}" style="width:${pctVal}%"></div></div>`;
}

function scenarioRows(f) {
  return f.scenarios
    .map(
      (s) => `
      <tr class="scn">
        <td class="scn__name">${s.outline ? "▤ " : ""}${esc(s.name)}</td>
        <td>${pill("st-" + s.status, STATUS_LABEL[s.status])}</td>
        <td>${
          s.status === "automated"
            ? pill("lv-" + s.live, LIVE_LABEL[s.live])
            : '<span class="muted">—</span>'
        }</td>
      </tr>`,
    )
    .join("");
}

function featureBlocks() {
  return features
    .map((f) => {
      const cov = pct(f.automated, f.total);
      const live =
        f.automated === 0
          ? '<span class="muted">—</span>'
          : !hasResults
            ? '<span class="muted">not run</span>'
            : f.failed
              ? pill("lv-failed", `${f.passed}/${f.automated} · ${f.failed} failing`)
              : pill("lv-passed", `${f.passed}/${f.automated} passing`);
      return `
      <details class="feat" ${f.failed ? "open" : ""}>
        <summary class="feat__sum">
          <span class="feat__name">${esc(f.name)}</span>
          <span class="impact impact--${f.impact.toLowerCase()}">${f.impact}</span>
          <span class="feat__counts">
            ${f.automated} auto · ${f.wip} wip · ${f.expected} exp · ${f.ungated} ungated
          </span>
          <span class="feat__bar">${bar(cov, f.failed ? "bad" : "ok")}<em>${cov}%</em></span>
          <span class="feat__live">${live}</span>
        </summary>
        <table class="scn__table">
          <thead><tr><th>Scenario</th><th>Status</th><th>Live</th></tr></thead>
          <tbody>${scenarioRows(f)}</tbody>
        </table>
      </details>`;
    })
    .join("");
}

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Constella — Test Bench</title>
<style>
  :root{
    --bg:#f7f7f8; --panel:#fff; --ink:#16161a; --muted:#6b6b76; --line:#e6e6ea;
    --ok:#1f9d57; --okb:#d6f0e0; --bad:#d8463c; --badb:#f8dad7;
    --auto:#1f9d57; --wip:#d9912b; --exp:#5b73d6; --ung:#8a8a96;
    --accent:#c2510d;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#0b0b0d; --panel:#151518; --ink:#ececf0; --muted:#9a9aa6; --line:#26262c;
      --okb:#10331f; --badb:#3a1714; --accent:#ef8a3f; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .wrap{max-width:1040px;margin:0 auto;padding:32px 20px 64px}
  h1{font-size:22px;margin:0 0 2px;letter-spacing:-.01em}
  h1 b{color:var(--accent)}
  .sub{color:var(--muted);margin:0 0 24px;font-size:13px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .card .n{font-size:26px;font-weight:650;letter-spacing:-.02em}
  .card .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .hero{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
  @media(max-width:680px){.hero{grid-template-columns:1fr}}
  .hero .card{padding:18px}
  .big{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1}
  .bar{height:9px;border-radius:6px;background:var(--line);overflow:hidden;flex:1}
  .bar__fill{height:100%;border-radius:6px;background:var(--ok)}
  .bar__fill.bad{background:var(--bad)}
  .hero .barrow{display:flex;align-items:center;gap:10px;margin-top:12px}
  .legend{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:550;
    border:1px solid transparent;white-space:nowrap}
  .st-automated{color:var(--auto);background:var(--okb)}
  .st-wip{color:var(--wip);background:color-mix(in srgb,var(--wip) 16%,transparent)}
  .st-expected{color:var(--exp);background:color-mix(in srgb,var(--exp) 16%,transparent)}
  .st-ungated{color:var(--ung);background:color-mix(in srgb,var(--ung) 16%,transparent)}
  .lv-passed{color:var(--ok);background:var(--okb)}
  .lv-failed{color:var(--bad);background:var(--badb)}
  .lv-notrun,.lv-other{color:var(--muted);background:var(--line)}
  .impact{font-size:11px;font-weight:600;padding:1px 8px;border-radius:6px}
  .impact--critical{color:#fff;background:var(--accent)}
  .impact--high{color:var(--exp);background:color-mix(in srgb,var(--exp) 16%,transparent)}
  .impact--standard{color:var(--muted);background:var(--line)}
  .feat{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden}
  .feat__sum{display:grid;grid-template-columns:1.5fr auto 1.4fr 1fr auto;gap:12px;align-items:center;
    padding:13px 16px;cursor:pointer;list-style:none}
  .feat__sum::-webkit-details-marker{display:none}
  .feat__name{font-weight:600}
  .feat__counts{color:var(--muted);font-size:12px}
  .feat__bar{display:flex;align-items:center;gap:8px;min-width:120px}
  .feat__bar em{font-style:normal;color:var(--muted);font-size:12px;min-width:30px;text-align:right}
  .feat__live{justify-self:end}
  @media(max-width:680px){.feat__sum{grid-template-columns:1fr;gap:6px}.feat__live{justify-self:start}}
  .scn__table{width:100%;border-collapse:collapse;border-top:1px solid var(--line)}
  .scn__table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;
    color:var(--muted);padding:8px 16px;background:color-mix(in srgb,var(--ink) 3%,transparent)}
  .scn__table td{padding:8px 16px;border-top:1px solid var(--line);vertical-align:top}
  .scn__name{font-size:13px}
  .muted{color:var(--muted)}
  footer{color:var(--muted);font-size:12px;margin-top:26px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <h1>Constella — <b>Test Bench</b></h1>
  <p class="sub">Living BDD coverage · ${features.length} feature files · ${stamp}
    ${hasResults ? "· overlaid with last <code>test:net</code> run" : "· no run results yet (run <code>npm run test:net</code>)"}</p>

  <div class="hero">
    <div class="card">
      <div class="k">Automation coverage</div>
      <div class="big">${coveragePct}%</div>
      <div class="barrow">${bar(coveragePct)}<span class="muted">${totals.automated}/${totals.total} authored scenarios automated</span></div>
    </div>
    <div class="card">
      <div class="k">Net pass rate</div>
      <div class="big">${hasResults ? passPct + "%" : "—"}</div>
      <div class="barrow">${bar(hasResults ? passPct : 0, totals.failed ? "bad" : "ok")}<span class="muted">${
        hasResults ? `${totals.passed}/${totals.automated} passing${totals.failed ? ` · ${totals.failed} failing` : ""}` : "not run"
      }</span></div>
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="n">${totals.total}</div><div class="k">Authored</div></div>
    <div class="card"><div class="n" style="color:var(--auto)">${totals.automated}</div><div class="k">Automated</div></div>
    <div class="card"><div class="n" style="color:var(--wip)">${totals.wip}</div><div class="k">WIP (deferred)</div></div>
    <div class="card"><div class="n" style="color:var(--exp)">${totals.expected}</div><div class="k">Expected (aspirational)</div></div>
    <div class="card"><div class="n" style="color:var(--ung)">${totals.ungated}</div><div class="k">Ungated</div></div>
    <div class="card"><div class="n">${benchPct}%</div><div class="k">of ${BENCH_TOTAL}-scenario bench authored</div></div>
  </div>

  <div class="legend">
    ${pill("st-automated", "Automated — in the green safety net")}
    ${pill("st-wip", "WIP — grounded, not yet automatable")}
    ${pill("st-expected", "Expected — aspirational spec")}
    ${pill("st-ungated", "Ungated — not in a tag gate")}
    ${pill("lv-passed", "Passed")} ${pill("lv-failed", "Failed")} ${pill("lv-notrun", "Not run")}
  </div>

  ${featureBlocks()}

  <footer>Generated by <code>tests/coverage-report.mjs</code> — re-run after <code>npm run test:net</code> to refresh live results.</footer>
</div>
</body>
</html>`;

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

console.log(`coverage.html written → ${path.relative(ROOT, OUT)}`);
console.log(
  `authored=${totals.total}  automated=${totals.automated}  wip=${totals.wip}  expected=${totals.expected}  ungated=${totals.ungated}`,
);
console.log(
  hasResults
    ? `live: ${totals.passed}/${totals.automated} automated passing, ${totals.failed} failing`
    : "live: no cucumber-report.json found (run npm run test:net first)",
);
console.log(`coverage=${coveragePct}%  pass=${hasResults ? passPct + "%" : "n/a"}  bench=${benchPct}% of ${BENCH_TOTAL}`);

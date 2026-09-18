import { useEffect, useMemo, useRef, useState } from "react";
import { readTextAsRaw } from "./ingest";
import { detectStructure } from "../core/detect";
import { decideImport } from "./importFlow";
import { SLOT_COUNT, SLOTS, showcaseFileFor } from "../config/showcase";

/* The curation bench — /bench, DEV ONLY (route gated in App.tsx; both write
   endpoints exist only in the dev server, see vite.config.ts).

   Staging model, saved EXPLICITLY: naming slugs and dropping JSONs stages
   changes in the page; nothing touches disk until "Save bench", which writes
   the staged files to public/showcase/ AND rewrites the SLOTS ledger in
   src/config/showcase.ts — so the bench reopens exactly as saved, and the
   ledger (not component memory) is the record. cbv ships the files; this
   page never ships. */

interface Slot {
  slug: string;
  /** Validated-but-unsaved upload. */
  staged: { text: string; nodes: number } | null;
  /** Live on disk under the CURRENT slug (probed on mount/slug change). */
  live: { nodes: number } | null;
  /** Live slot marked for removal at save. */
  clearing: boolean;
  error: string | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const emptySlot = (slug = ""): Slot => ({
  slug,
  staged: null,
  live: null,
  clearing: false,
  error: null,
});

export function BenchPage() {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => emptySlot(SLOTS[i] ?? "")),
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const dirty = useMemo(
    () => slots.some((s) => s.staged !== null || s.clearing),
    [slots],
  );

  const patch = (i: number, p: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));

  // Probe live status for every named slug (ledger-restored or user-typed).
  useEffect(() => {
    let cancelled = false;
    slots.forEach((s, i) => {
      if (!SLUG_RE.test(s.slug) || s.staged || s.live || s.clearing) return;
      void (async () => {
        try {
          const res = await fetch(showcaseFileFor(s.slug));
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || type.includes("text/html")) return;
          const doc = JSON.parse(await res.text()) as { nodes?: unknown[] };
          if (!cancelled)
            patch(i, { live: { nodes: Array.isArray(doc.nodes) ? doc.nodes.length : 0 } });
        } catch {
          /* stays empty */
        }
      })();
    });
    return () => {
      cancelled = true;
    };
    // Re-probe when slugs change; staged/live guards stop loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.map((s) => s.slug).join("|")]);

  async function stage(i: number, file: File) {
    const s = slots[i];
    try {
      const text = await file.text();
      // Full app pipeline — the bench refuses anything /v/ would choke on.
      const raw = readTextAsRaw("json", text, file.name);
      const detection = detectStructure(raw);
      const { graph } = decideImport(raw, detection);
      if (!graph) throw new Error("Parsed, but no graph came out — check the manifest shape.");
      patch(i, {
        staged: { text, nodes: graph.nodes.length },
        clearing: false,
        error: null,
      });
    } catch (err) {
      patch(i, {
        error: err instanceof Error ? err.message : "Could not read that file.",
        staged: null,
      });
    }
    void s;
  }

  async function saveBench() {
    setSaving(true);
    try {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.staged && SLUG_RE.test(s.slug)) {
          const res = await fetch(`/__bench/${s.slug}`, { method: "PUT", body: s.staged.text });
          if (!res.ok) throw new Error(`Slot ${i + 1} (${s.slug}): save failed ${res.status}`);
        }
        if (s.clearing && SLUG_RE.test(s.slug)) {
          await fetch(`/__bench/${s.slug}`, { method: "DELETE" });
        }
      }
      const ledger = slots
        .map((s) => (s.clearing ? "" : s.slug))
        .map((slug, i) => {
          const s = slots[i];
          return slug && (s.staged || s.live) && !s.clearing ? slug : "";
        });
      const res = await fetch("/__bench-ledger", {
        method: "PUT",
        body: JSON.stringify(ledger),
      });
      if (!res.ok) throw new Error("Ledger write failed — slot layout NOT saved.");
      setSlots((prev) =>
        prev.map((s) =>
          s.clearing
            ? emptySlot()
            : s.staged
              ? { ...s, live: { nodes: s.staged.nodes }, staged: null }
              : s,
        ),
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      // Surface on the bench header rather than a lost console line.
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bench">
      <header className="bench__head">
        <h1 className="bench__title">Showcase bench</h1>
      </header>

      <div className="bench__slots">
        {slots.map((s, i) => {
          const slugOk = SLUG_RE.test(s.slug);
          const status = s.error
            ? s.error
            : s.clearing
              ? "will be removed on save"
              : s.staged
                ? `staged · ${s.staged.nodes} nodes — unsaved`
                : s.live
                  ? `live · ${s.live.nodes} nodes`
                  : slugOk
                    ? "empty — drop a JSON here"
                    : "name the slug first";
          return (
            <div
              key={i}
              className={`bench-slot${s.live && !s.clearing ? " is-filled" : ""}${
                s.staged ? " is-staged" : ""
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && slugOk) void stage(i, f);
              }}
            >
              <span className="bench-slot__n">{i + 1}</span>
              <input
                className="bench-slot__slug"
                value={s.slug}
                placeholder="slug"
                spellCheck={false}
                onChange={(e) =>
                  patch(i, {
                    slug: e.target.value.trim().toLowerCase(),
                    live: null,
                    error: null,
                  })
                }
              />
              <span
                className={`bench-slot__status${
                  s.error
                    ? " bench-slot__status--error"
                    : s.staged || s.clearing
                      ? " bench-slot__status--staged"
                      : s.live
                        ? " bench-slot__status--filled"
                        : ""
                }`}
              >
                {status}
              </span>
              <span className="bench-slot__actions">
                {s.live && !s.clearing && (
                  <a
                    className="bench-slot__link"
                    href={`/v/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    /v/{s.slug} ↗
                  </a>
                )}
                <button
                  type="button"
                  className="bench-slot__btn"
                  disabled={!slugOk || saving}
                  onClick={() => fileRefs.current[i]?.click()}
                >
                  {s.live || s.staged ? "Replace" : "Upload"}
                </button>
                {(s.live || s.staged || s.clearing) && (
                  <button
                    type="button"
                    className="bench-slot__btn bench-slot__btn--quiet"
                    disabled={saving}
                    onClick={() =>
                      s.staged
                        ? patch(i, { staged: null })
                        : patch(i, { clearing: !s.clearing })
                    }
                  >
                    {s.clearing ? "Keep" : "Clear"}
                  </button>
                )}
              </span>
              <input
                ref={(el) => {
                  fileRefs.current[i] = el;
                }}
                type="file"
                accept=".json,application/json"
                className="visually-hidden"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void stage(i, f);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      {/* The commit point — nothing above touches disk until this. */}
      <div className={`bench__savebar${dirty || savedFlash ? " is-visible" : ""}`}>
        <span className="bench__savemsg">
          {savedFlash
            ? "Saved — files written, ledger updated."
            : `${slots.filter((s) => s.staged).length + slots.filter((s) => s.clearing).length} unsaved change${
                slots.filter((s) => s.staged || s.clearing).length === 1 ? "" : "s"
              }`}
        </span>
        {dirty && (
          <button
            type="button"
            className="bench__save"
            disabled={saving}
            onClick={() => void saveBench()}
          >
            {saving ? "Saving…" : "Save bench"}
          </button>
        )}
      </div>
    </section>
  );
}

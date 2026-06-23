import { useMemo, useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

const ALPHA = "ABCDEFGHIJKL";
const colLabels = (n: number) => Array.from({ length: n }, (_, i) => ALPHA[i]);
const rowLabels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const key = (c: string, r: string) => `${c}${r}`;

type Cell = { kind: string; dir?: string };

const ARROW: Record<string, string> = { nord: "↑", ost: "→", sued: "↓", west: "←" };

/** glyph + tailwind colour classes per element. */
function glyph(cell: Cell): { ch: string; cls: string } {
  switch (cell.kind) {
    case "pfeil": return { ch: ARROW[cell.dir ?? "nord"] ?? "↑", cls: "text-slate-800" };
    case "gefahr": return { ch: "⚠", cls: "text-red-600" };
    case "sammelplatz": return { ch: "S", cls: "text-green-700 font-bold" };
    case "ziel": return { ch: "◎", cls: "text-blue-600" };
    default: return { ch: "?", cls: "" };
  }
}

function Grid({ cols, rows, cell }: { cols: string[]; rows: string[]; cell: (k: string) => React.ReactNode }) {
  return (
    <div className="inline-block overflow-auto max-w-full">
      <div className="grid gap-1" style={{ gridTemplateColumns: `1.5rem repeat(${cols.length}, 2.25rem)` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="text-center text-xs font-bold text-slate-500">{c}</div>
        ))}
        {rows.map((r) => (
          <span key={r} className="contents">
            <div className="flex items-center justify-center text-xs font-bold text-slate-500">{r}</div>
            {cols.map((c) => (
              <div key={c}>{cell(key(c, r))}</div>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SkizzeLeit({ payload }: LeitViewProps) {
  const cells: Record<string, Cell> = payload.cells ?? {};
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Lage Feld für Feld durchgeben (Position + Element, bei Pfeilen die Richtung).</p>
      <Grid
        cols={payload.colLabels}
        rows={payload.rowLabels}
        cell={(k) => {
          const el = cells[k];
          const g = el ? glyph(el) : null;
          return (
            <div className={`w-9 h-9 rounded-md border flex items-center justify-center text-lg ${el ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"} ${g?.cls ?? ""}`}>
              {g?.ch}
            </div>
          );
        }}
      />
    </div>
  );
}

const BRUSHES: { id: string; label: string; cell: Cell | null }[] = [
  { id: "n", label: "↑", cell: { kind: "pfeil", dir: "nord" } },
  { id: "o", label: "→", cell: { kind: "pfeil", dir: "ost" } },
  { id: "s", label: "↓", cell: { kind: "pfeil", dir: "sued" } },
  { id: "w", label: "←", cell: { kind: "pfeil", dir: "west" } },
  { id: "gefahr", label: "⚠ Gefahr", cell: { kind: "gefahr" } },
  { id: "sammelplatz", label: "S Sammelplatz", cell: { kind: "sammelplatz" } },
  { id: "ziel", label: "◎ Ziel", cell: { kind: "ziel" } },
  { id: "del", label: "Löschen", cell: null },
];

const sameCell = (a: Cell | undefined, b: Cell | null) =>
  !!a && !!b && a.kind === b.kind && (a.dir ?? "") === (b.dir ?? "");

export function SkizzeTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const cols = useMemo(() => colLabels(config.cols ?? 6), [config.cols]);
  const rows = useMemo(() => rowLabels(config.rows ?? 6), [config.rows]);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [brush, setBrush] = useState<string>("n");
  const locked = lastResult != null;
  const heat = lastResult?.detail?.heatmap as Record<string, string> | undefined;
  const active = BRUSHES.find((b) => b.id === brush)!;

  const paint = (k: string) =>
    setCells((p) => {
      const n = { ...p };
      if (!active.cell || sameCell(n[k], active.cell)) delete n[k];
      else n[k] = active.cell;
      return n;
    });

  const heatCls = (s: string | undefined) =>
    s === "ok" ? "bg-green-500 border-green-600 text-white"
    : s === "miss" ? "bg-amber-400 border-amber-500"
    : s === "false" || s === "wrong" ? "bg-red-400 border-red-500 text-white"
    : "bg-slate-50 border-slate-200";

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Werkzeug wählen, dann Feld antippen:</p>
        <div className="flex flex-wrap gap-1">
          {BRUSHES.map((b) => (
            <button
              key={b.id}
              disabled={locked}
              onClick={() => setBrush(b.id)}
              className={`px-2 py-1 rounded-md border text-sm ${brush === b.id ? "bg-brand border-brand-dark text-white" : "bg-white border-slate-300 hover:bg-slate-50"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <Grid
          cols={cols}
          rows={rows}
          cell={(k) => {
            const el = cells[k];
            const g = el ? glyph(el) : null;
            const cls = locked ? heatCls(heat?.[k]) : el ? "bg-brand/10 border-brand" : "bg-white border-slate-300 hover:bg-slate-50";
            return (
              <button
                disabled={locked}
                onClick={() => paint(k)}
                className={`w-9 h-9 rounded-md border inline-flex items-center justify-center text-lg ${cls} ${!locked && g ? g.cls : ""}`}
              >
                {g?.ch}
              </button>
            );
          }}
        />
      </div>
      {!locked && (
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setCells({})}>Zurücksetzen</button>
          <button className="btn-primary flex-1" disabled={submitting} onClick={() => onSubmit({ cells })}>
            {submitting ? "Sende…" : "Abgeben"}
          </button>
        </div>
      )}
    </div>
  );
}

export function SkizzeConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="label">Spalten</label>
        <input type="number" min={2} max={12} className="input" value={config.cols ?? 6}
          onChange={(e) => set({ cols: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Zeilen</label>
        <input type="number" min={2} max={12} className="input" value={config.rows ?? 6}
          onChange={(e) => set({ rows: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Elemente</label>
        <input type="number" min={1} max={48} className="input" value={config.count ?? 5}
          onChange={(e) => set({ count: Number(e.target.value) })} />
      </div>
    </div>
  );
}

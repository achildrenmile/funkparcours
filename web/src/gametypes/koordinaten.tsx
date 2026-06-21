import { useMemo, useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const colLabels = (n: number) => Array.from({ length: n }, (_, i) => ALPHA[i]);
const rowLabels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const key = (c: string, r: string) => `${c}${r}`;

function Grid({
  cols,
  rows,
  cell,
}: {
  cols: string[];
  rows: string[];
  cell: (k: string) => React.ReactNode;
}) {
  return (
    <div className="inline-block overflow-auto max-w-full">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `1.5rem repeat(${cols.length}, 2rem)` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="text-center text-xs font-bold text-slate-500">{c}</div>
        ))}
        {rows.map((r) => (
          <Row key={r} r={r} cols={cols} cell={cell} />
        ))}
      </div>
    </div>
  );
}
function Row({ r, cols, cell }: { r: string; cols: string[]; cell: (k: string) => React.ReactNode }) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-bold text-slate-500">{r}</div>
      {cols.map((c) => (
        <div key={c}>{cell(key(c, r))}</div>
      ))}
    </>
  );
}

export function KoordinatenLeit({ payload }: LeitViewProps) {
  const markers = new Set<string>(payload.markers ?? []);
  return (
    <Grid
      cols={payload.colLabels}
      rows={payload.rowLabels}
      cell={(k) => (
        <div
          className={`w-8 h-8 rounded-sm border flex items-center justify-center text-sm ${
            markers.has(k) ? "bg-funk-600 border-funk-700 text-white" : "bg-slate-50 border-slate-200"
          }`}
        >
          {markers.has(k) ? "✚" : ""}
        </div>
      )}
    />
  );
}

export function KoordinatenTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const cols = useMemo(() => colLabels(config.cols ?? 8), [config.cols]);
  const rows = useMemo(() => rowLabels(config.rows ?? 8), [config.rows]);
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const locked = lastResult != null;
  const heat = lastResult?.detail?.heatmap as Record<string, string> | undefined;

  const toggle = (k: string) =>
    setMarks((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="card">
        <p className="text-sm text-slate-500 mb-2">Gehörte Koordinaten anklicken (z.B. „C5"):</p>
        <Grid
          cols={cols}
          rows={rows}
          cell={(k) => {
            const h = heat?.[k];
            const cls = locked
              ? h === "hit"
                ? "bg-green-500 border-green-600 text-white"
                : h === "miss"
                  ? "bg-amber-400 border-amber-500"
                  : h === "false"
                    ? "bg-red-400 border-red-500 text-white"
                    : "bg-slate-50 border-slate-200"
              : marks.has(k)
                ? "bg-funk-600 border-funk-700 text-white"
                : "bg-white border-slate-300 hover:bg-slate-50";
            return (
              <button
                disabled={locked}
                onClick={() => toggle(k)}
                className={`w-8 h-8 rounded-sm border text-sm ${cls}`}
              >
                {(locked ? h === "hit" || h === "false" : marks.has(k)) ? "✚" : ""}
              </button>
            );
          }}
        />
      </div>
      {!locked && (
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setMarks(new Set())}>Zurücksetzen</button>
          <button className="btn-primary flex-1" disabled={submitting} onClick={() => onSubmit({ markers: [...marks] })}>
            {submitting ? "Sende…" : "Abgeben"}
          </button>
        </div>
      )}
    </div>
  );
}

export function KoordinatenConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="label">Spalten</label>
        <input type="number" min={2} max={20} className="input" value={config.cols ?? 8}
          onChange={(e) => set({ cols: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Zeilen</label>
        <input type="number" min={2} max={20} className="input" value={config.rows ?? 8}
          onChange={(e) => set({ rows: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Marker</label>
        <input type="number" min={1} max={40} className="input" value={config.markerCount ?? 5}
          onChange={(e) => set({ markerCount: Number(e.target.value) })} />
      </div>
    </div>
  );
}

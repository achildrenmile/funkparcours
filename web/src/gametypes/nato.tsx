import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "Xray",
  Y: "Yankee", Z: "Zulu",
};

export function NatoLeit({ payload }: LeitViewProps) {
  const items: string[] = payload.items ?? [];
  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <span className="font-mono text-2xl tracking-widest">{w}</span>
            <span className="text-xs text-slate-500">
              {w.split("").map((ch) => NATO[ch.toUpperCase()] ?? ch).join(" · ")}
            </span>
          </li>
        ))}
      </ol>
      {payload.showReference && (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer">NATO-Alphabet</summary>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mt-2">
            {Object.entries(NATO).map(([k, v]) => (
              <span key={k}>
                <b>{k}</b> {v}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function NatoTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const count: number = config.count ?? 4;
  const [items, setItems] = useState<string[]>(Array(count).fill(""));
  const locked = lastResult != null;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Gehörte Wörter/Rufzeichen eintippen:</p>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <input
              className="input font-mono uppercase tracking-widest"
              disabled={locked}
              value={items[i] ?? ""}
              onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </div>
        ))}
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ items })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function NatoConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Modus</label>
        <select className="input" value={config.mode ?? "mix"} onChange={(e) => set({ mode: e.target.value })}>
          <option value="rufzeichen">Rufzeichen</option>
          <option value="woerter">Wörter</option>
          <option value="mix">Mix</option>
        </select>
      </div>
      <div>
        <label className="label">Anzahl</label>
        <input type="number" min={1} max={20} className="input" value={config.count ?? 4}
          onChange={(e) => set({ count: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Min. Länge</label>
        <input type="number" min={2} max={12} className="input" value={config.minLen ?? 4}
          onChange={(e) => set({ minLen: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Max. Länge</label>
        <input type="number" min={2} max={12} className="input" value={config.maxLen ?? 7}
          onChange={(e) => set({ maxLen: Number(e.target.value) })} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.showReference ?? true}
          onChange={(e) => set({ showReference: e.target.checked })} />
        NATO-Referenz auf Sendebild zeigen
      </label>
    </div>
  );
}

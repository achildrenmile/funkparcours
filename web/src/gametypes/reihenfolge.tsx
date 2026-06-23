import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

export function ReihenfolgeLeit({ payload }: LeitViewProps) {
  const order: string[] = payload.order ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Reihenfolge der Reihe nach durchgeben:</p>
      <ol className="space-y-2">
        {order.map((it, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <span className="text-lg">{it}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ReihenfolgeTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const [order, setOrder] = useState<string[]>(config.items ?? []);
  const locked = lastResult != null;
  const perPos = lastResult?.detail?.perPos as boolean[] | undefined;

  const move = (i: number, d: -1 | 1) =>
    setOrder((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = p.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">In die gehörte Reihenfolge bringen:</p>
        <ol className="space-y-1">
          {order.map((it, i) => {
            const ok = perPos?.[i];
            const cls = locked
              ? ok ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"
              : "bg-white border-slate-300";
            return (
              <li key={it} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${cls}`}>
                <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
                <span className="flex-1">{it}</span>
                {!locked && (
                  <span className="flex gap-1">
                    <button className="btn-ghost px-2 py-0.5" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button className="btn-ghost px-2 py-0.5" disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ order })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function ReihenfolgeConfigForm({ config, onChange }: ConfigFormProps) {
  const items: string[] = config.items ?? [];
  const set = (next: string[]) => onChange({ ...config, items: next });
  return (
    <div className="space-y-2">
      <label className="label">Einträge (Reihenfolge wird je Runde zufällig vorgegeben)</label>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
          <input
            className="input flex-1"
            value={it}
            onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button className="btn-ghost" disabled={items.length <= 2} onClick={() => set(items.filter((_, j) => j !== i))}>
            Entfernen
          </button>
        </div>
      ))}
      {items.length < 12 && (
        <button className="btn-ghost" onClick={() => set([...items, `Eintrag ${items.length + 1}`])}>
          + Eintrag
        </button>
      )}
    </div>
  );
}

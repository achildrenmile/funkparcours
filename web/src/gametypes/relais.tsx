import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

export function RelaisLeit({ payload }: LeitViewProps) {
  const incoming: string | null = payload.incoming ?? null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Diese Nachricht exakt an die nächste Gruppe weitergeben:</p>
      {incoming ? (
        <p className="text-lg leading-relaxed font-medium">{incoming}</p>
      ) : (
        <p className="text-slate-400">Noch keine Nachricht – warte auf die vorherige Gruppe.</p>
      )}
    </div>
  );
}

export function RelaisTrupp({ onSubmit, submitting, lastResult }: TruppViewProps) {
  const [text, setText] = useState("");
  const locked = lastResult != null;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Gehörte Nachricht möglichst wortgetreu mitschreiben:</p>
        <textarea
          className="input min-h-28"
          disabled={locked}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z.B. Florian 1 an Basis 1: 3 Personen am Bahnhof, Lage Verkehrsunfall, kommen."
        />
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting || !text.trim()} onClick={() => onSubmit({ text })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function RelaisConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="space-y-2">
      <div>
        <label className="label">Nachrichtenlänge</label>
        <select className="input" value={config.length ?? "normal"} onChange={(e) => set({ length: e.target.value })}>
          <option value="kurz">Kurz</option>
          <option value="normal">Normal</option>
          <option value="lang">Lang</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Kette = Reihenfolge der Gruppen. Gruppe 1 erhält das Original, jede weitere Gruppe die Mitschrift der
        vorigen. Jede Gruppe wird gegen das Original gewertet (Drift sichtbar).
      </p>
    </div>
  );
}

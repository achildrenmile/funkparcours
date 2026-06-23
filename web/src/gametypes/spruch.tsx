import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

type Token =
  | { type: "text"; text: string }
  | { type: "slot"; key: string; kind: string; value: string };

/** Phrase skeletons (no values) — mirror of shared SPRUCH_TEMPLATES. */
const TEMPLATES: { id: string; parts: (string | { kind: string })[] }[] = [
  { id: "ruf", parts: [{ kind: "callsign" }, " von ", { kind: "callsign" }, ", kommen."] },
  { id: "standort", parts: ["Hier ", { kind: "callsign" }, ", Standort ", { kind: "ort" }, ", kommen."] },
  { id: "lage", parts: [{ kind: "callsign" }, ", Lage ", { kind: "lage" }, ", Priorität ", { kind: "prio" }, ", Ende."] },
  { id: "personen", parts: ["Verstanden, ", { kind: "anzahl" }, " Personen am ", { kind: "ort" }, ", kommen."] },
  { id: "treffpunkt", parts: [{ kind: "callsign" }, " an ", { kind: "callsign" }, ": Treffpunkt ", { kind: "ort" }, " um ", { kind: "zeit" }, ", kommen."] },
  { id: "status", parts: [{ kind: "callsign" }, " meldet ", { kind: "status" }, ", Ende."] },
];
const byId = (id: string) => TEMPLATES.find((t) => t.id === id);

export function SpruchLeit({ payload }: LeitViewProps) {
  const items: { tokens: Token[] }[] = payload.items ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Funkspruch vollständig vorlesen – der Trupp füllt die Lücken.</p>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <p className="text-lg leading-relaxed">
              {item.tokens.map((t, j) =>
                t.type === "text" ? <span key={j}>{t.text}</span> : <b key={j} className="text-brand">{t.value}</b>,
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SpruchTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const ids: string[] = config.templateIds ?? [];
  const [answers, setAnswers] = useState<Record<string, string>[]>(ids.map(() => ({})));
  const locked = lastResult != null;
  const set = (i: number, key: string, v: string) =>
    setAnswers((p) => p.map((a, j) => (j === i ? { ...a, [key]: v } : a)));
  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <p className="text-sm text-slate-500">Lücken aus dem gehörten Funkspruch ausfüllen:</p>
        {ids.map((id, i) => {
          let s = 0;
          return (
            <p key={i} className="leading-loose">
              <span className="text-slate-400 mr-1">{i + 1}.</span>
              {(byId(id)?.parts ?? []).map((part, j) => {
                if (typeof part === "string") return <span key={j}>{part}</span>;
                const key = `s${s++}`;
                return (
                  <input
                    key={j}
                    className="input inline-block w-36 mx-1 py-0.5 align-baseline"
                    disabled={locked}
                    value={answers[i]?.[key] ?? ""}
                    onChange={(e) => set(i, key, e.target.value)}
                  />
                );
              })}
            </p>
          );
        })}
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ items: answers })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

/** render a skeleton with "____" for slots, for the config preview. */
function preview(id: string): string {
  return (byId(id)?.parts ?? []).map((p) => (typeof p === "string" ? p : "____")).join("");
}

export function SpruchConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  const ids: string[] = config.templateIds ?? [];
  const toggle = (id: string) =>
    set({ templateIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Funksprüche (mind. einer)</label>
        <div className="space-y-1">
          {TEMPLATES.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ids.includes(t.id)} onChange={() => toggle(t.id)} />
              <span className="text-slate-600">{preview(t.id)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tipptoleranz (0–1)</label>
          <input type="number" min={0} max={1} step={0.05} className="input" value={config.fuzzyThreshold ?? 0.8}
            onChange={(e) => set({ fuzzyThreshold: Number(e.target.value) })} />
        </div>
        <label className="flex items-end gap-2 text-sm pb-2">
          <input type="checkbox" checked={config.fuzzy ?? true}
            onChange={(e) => set({ fuzzy: e.target.checked })} />
          Tippfehler tolerieren
        </label>
      </div>
    </div>
  );
}

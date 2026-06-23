import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

const LETTERS = ["A", "B", "C", "D"];

export function QuizLeit({ payload }: LeitViewProps) {
  const questions: { q: string; options: string[]; correctIndex: number }[] = payload.questions ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Frage und Antwortmöglichkeiten vorlesen (Lösung ist markiert – nicht verraten).</p>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={i}>
            <p className="font-medium">{i + 1}. {q.q}</p>
            <ul className="mt-1 space-y-0.5">
              {q.options.map((o, j) => (
                <li key={j} className={j === q.correctIndex ? "text-green-700 font-semibold" : "text-slate-600"}>
                  {LETTERS[j]}) {o}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function QuizTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const count: number = config.count ?? 5;
  const [answers, setAnswers] = useState<number[]>(Array(count).fill(-1));
  const locked = lastResult != null;
  const perQuestion = lastResult?.detail?.perQuestion as boolean[] | undefined;
  const pick = (i: number, j: number) => setAnswers((p) => p.map((x, k) => (k === i ? j : x)));

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <p className="text-sm text-slate-500">Gehörten Antwortbuchstaben je Frage wählen:</p>
        {Array.from({ length: count }, (_, i) => {
          const ok = perQuestion?.[i];
          return (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-6 text-right ${locked ? (ok ? "text-green-600" : "text-red-600") : "text-slate-400"}`}>{i + 1}.</span>
              <div className="flex gap-1">
                {LETTERS.map((L, j) => (
                  <button
                    key={j}
                    disabled={locked}
                    onClick={() => pick(i, j)}
                    className={`w-9 h-9 rounded-md border font-semibold ${
                      answers[i] === j ? "bg-brand border-brand-dark text-white" : "bg-white border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {L}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ answers })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function QuizConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Anzahl Fragen</label>
        <input type="number" min={1} max={12} className="input" value={config.count ?? 5}
          onChange={(e) => set({ count: Number(e.target.value) })} />
      </div>
    </div>
  );
}

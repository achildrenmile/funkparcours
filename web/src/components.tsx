import { useEffect, useState } from "react";
import { ClockIcon } from "./icons";

export function Header({ title, sub }: { title?: string; sub?: string }) {
  return (
    <header className="bg-ink text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/oeradio-logo.webp" alt="OERadio" className="h-9 w-auto" />
          <span className="font-bold text-base hidden sm:block whitespace-nowrap">
            Funk<span className="text-brand-light">Parcours</span>
          </span>
        </a>
        {(title || sub) && (
          <div className="text-right min-w-0 flex-1">
            {title && <div className="font-semibold leading-tight truncate">{title}</div>}
            {sub && <div className="text-xs text-slate-300 truncate">{sub}</div>}
          </div>
        )}
      </div>
      <div className="h-1 bg-brand" />
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-4xl mx-auto p-4 sm:p-5 space-y-4">{children}</div>;
}

/** Live timer counting up from a server-provided ISO start time. */
export function Timer({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);
  const ms = startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-semibold">
      <ClockIcon size={18} className="text-brand" />
      {startedAt ? fmt(ms) : "--:--"}
    </span>
  );
}

export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Pct({ v }: { v: number | null }) {
  return <span>{v == null ? "–" : `${Math.round(v * 100)}%`}</span>;
}

export function Banner({ kind, children }: { kind: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const cls =
    kind === "ok"
      ? "bg-sage/20 text-emerald-900 border-sage"
      : kind === "warn"
        ? "bg-brand/10 text-brand-dark border-brand/40"
        : "bg-slate-100 text-slate-700 border-slate-200";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

import { useEffect, useState } from "react";

export function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="bg-funk-700 text-white px-4 py-3 shadow">
      <div className="max-w-4xl mx-auto flex items-baseline justify-between">
        <h1 className="text-lg font-bold tracking-tight">📻 FunkParcours</h1>
        <div className="text-right">
          <div className="font-medium">{title}</div>
          {sub && <div className="text-xs text-blue-100">{sub}</div>}
        </div>
      </div>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-4xl mx-auto p-4 space-y-4">{children}</div>;
}

/** Live timer counting up from a server-provided ISO start time. */
export function Timer({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return <span className="font-mono">--:--</span>;
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  return <span className="font-mono tabular-nums">{fmt(ms)}</span>;
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
      ? "bg-green-50 text-green-800 border-green-200"
      : kind === "warn"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-blue-50 text-blue-800 border-blue-200";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

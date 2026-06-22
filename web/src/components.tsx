import { useEffect, useState } from "react";
import { ClockIcon } from "./icons";
import { HelpButton, type HelpTopic } from "./help";

export function Header({
  title,
  sub,
  help,
  autoOpenHelp,
}: {
  title?: string;
  sub?: string;
  help?: HelpTopic;
  autoOpenHelp?: boolean;
}) {
  return (
    <header className="bg-ink text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 h-28 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <a href="https://oeradio.at" target="_blank" rel="noopener noreferrer">
            <img src="/oeradio-logo.webp" alt="OERadio" className="h-24 w-auto" />
          </a>
          <a href="/" className="font-bold text-lg hidden sm:block whitespace-nowrap">
            Funk<span className="text-brand-light">Parcours</span>
          </a>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          {(title || sub) && (
            <div className="text-right min-w-0">
              {title && <div className="font-semibold leading-tight truncate">{title}</div>}
              {sub && <div className="text-xs text-slate-300 truncate">{sub}</div>}
            </div>
          )}
          {help && <HelpButton topic={help} autoOpenOnce={autoOpenHelp} />}
        </div>
      </div>
      <div className="h-1 bg-brand" />
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-7rem)] flex flex-col">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-5 space-y-4 flex-1">{children}</div>
      <Footer />
    </div>
  );
}

const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export function Footer() {
  const link = "text-brand hover:underline";
  const dot = <span aria-hidden="true">•</span>;
  const bar = <span aria-hidden="true">|</span>;
  return (
    <footer className="border-t border-slate-200 bg-white/60 mt-6">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">FunkParcours v{APP_VERSION}</span>
          {dot}
          <a className={link} href="https://oeradio.at/" target="_blank" rel="noopener noreferrer">
            Teil von OE Radio Tools
          </a>
          {dot}
          <a className={link} href="https://oeradio.at/impressum/" target="_blank" rel="noopener noreferrer">
            Impressum
          </a>
          {bar}
          <a className={link} href="https://oeradio.at/datenschutz/" target="_blank" rel="noopener noreferrer">
            Datenschutz
          </a>
          {bar}
          <a
            className={link}
            href="https://github.com/achildrenmile/funkparcours"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
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

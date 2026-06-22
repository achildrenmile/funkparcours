import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner } from "../components";
import { rememberGame } from "../recent";

type Role = "all" | "leit" | "trupp";

interface LinkRow {
  groupId: string;
  name: string;
  leitUrl: string;
  truppUrl: string;
}

const ROLE_META = {
  leit: { label: "Leitstation", short: "Sender", color: "bg-brand text-white" },
  trupp: { label: "Empfangstrupp", short: "Empfänger", color: "bg-ink text-white" },
} as const;

export function AdminLinks() {
  const { code } = useParams();
  const nav = useNavigate();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [qr, setQr] = useState<Record<string, { leit: string; trupp: string }>>({});
  const [title, setTitle] = useState("");
  const [params, setParams] = useSearchParams();
  const role = (["all", "leit", "trupp"].includes(params.get("role") || "") ? params.get("role") : "all") as Role;
  const setRole = (r: Role) => setParams(r === "all" ? {} : { role: r }, { replace: true });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await api.get<any>(`/api/games/${code}`);
      rememberGame(code!, g.game.title);
      setTitle(g.game.title);
      setLinks(g.links);
      setQr(g.qr);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) nav(`/?code=${code}`);
      else setErr(String(e));
    }
  }, [code, nav]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Header title="Stationen & Links" sub={`Code ${code}`} help="admin-links" />
      <Page>
        {err && <Banner kind="warn">{err}</Banner>}

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <RoleTab v="all" role={role} set={setRole}>
            Alle
          </RoleTab>
          <RoleTab v="leit" role={role} set={setRole}>
            Sender (Leitstation)
          </RoleTab>
          <RoleTab v="trupp" role={role} set={setRole}>
            Empfänger (Empfangstrupp)
          </RoleTab>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" onClick={() => nav(`/admin/${code}/dashboard`)}>
              Dashboard
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              Drucken
            </button>
          </div>
        </div>

        <Banner kind="info">
          {role === "leit"
            ? "Diese Links an die jeweilige Leitstation (Sender) geben — sie sieht die Vorlage und funkt durch."
            : role === "trupp"
              ? "Diese Links an den jeweiligen Empfangstrupp (Empfänger) geben — er baut die Aufgabe nach."
              : "Pro Gruppe zwei Links: der Sender (Leitstation) sendet, der Empfänger (Empfangstrupp) baut nach."}
        </Banner>

        {/* print heading */}
        <h1 className="hidden print:block text-lg font-bold">
          {title} · Stationen ({code})
        </h1>

        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {links.map((l) => (
            <div key={l.groupId} className="card break-inside-avoid">
              <div className="font-bold text-lg mb-2">{l.name}</div>
              {(role === "all" || role === "leit") && (
                <StationBlock role="leit" name={l.name} url={l.leitUrl} qr={qr[l.groupId]?.leit} compact={role === "all"} />
              )}
              {(role === "all" || role === "trupp") && (
                <StationBlock role="trupp" name={l.name} url={l.truppUrl} qr={qr[l.groupId]?.trupp} compact={role === "all"} />
              )}
            </div>
          ))}
        </div>

        {links.length === 0 && !err && (
          <Banner kind="info">Noch keine Gruppen konfiguriert. Erst in der Konfiguration anlegen.</Banner>
        )}
      </Page>
    </>
  );
}

function RoleTab({
  v,
  role,
  set,
  children,
}: {
  v: Role;
  role: Role;
  set: (r: Role) => void;
  children: React.ReactNode;
}) {
  return (
    <button className={role === v ? "chip chip-on" : "chip"} onClick={() => set(v)}>
      {children}
    </button>
  );
}

function StationBlock({
  role,
  name,
  url,
  qr,
  compact,
}: {
  role: "leit" | "trupp";
  name: string;
  url: string;
  qr?: string;
  compact: boolean;
}) {
  const meta = ROLE_META[role];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · ${meta.label}`, url });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="border-t first:border-t-0 pt-3 mt-3 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${meta.color}`}>{meta.short}</span>
        <span className="text-sm text-slate-500">{meta.label}</span>
      </div>
      <div className="flex gap-3 items-start">
        {qr && <img src={qr} alt={`QR ${meta.label}`} className={compact ? "w-20 h-20" : "w-32 h-32"} />}
        <div className="min-w-0 flex-1">
          <a href={url} target="_blank" className="text-funk-600 text-xs break-all underline">
            {url}
          </a>
          <div className="flex gap-2 mt-2 print:hidden">
            <button className="btn-ghost text-sm px-3 min-h-[2.25rem]" onClick={copy}>
              {copied ? "Kopiert" : "Kopieren"}
            </button>
            <button className="btn-ghost text-sm px-3 min-h-[2.25rem]" onClick={share}>
              Teilen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

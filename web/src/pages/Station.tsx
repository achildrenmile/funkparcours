import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner, Timer, fmt } from "../components";
import { useGameSocket } from "../ws";
import { getFeGameType } from "../gametypes/registry";
import { BroadcastIcon, CheckIcon } from "../icons";

export function Station() {
  const { token } = useParams();
  const [state, setState] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await api.get(`/api/station/${token}`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);
  useGameSocket(token ? `token=${token}` : null, () => void load());

  if (err) return <Page><Banner kind="warn">{err}</Banner></Page>;
  if (!state) return <Page>Laden…</Page>;

  const roleLabel = state.role === "leit" ? "Leitstation · Sendebild" : "Empfangstrupp · Empfangsbild";

  return (
    <>
      <Header
        title={roleLabel}
        sub={`${state.gameTitle} · ${state.groupAvatar ? state.groupAvatar + " " : ""}${state.groupName}`}
        help={state.role === "leit" ? "leit" : "trupp"}
        autoOpenHelp
      />
      <Page>
        {state.gameStatus !== "running" && (
          <Banner kind="info">
            {state.gameStatus === "finished" ? "Übung beendet." : "Warten auf Start durch die Übungsleitung…"}
          </Banner>
        )}

        {state.gameStatus === "running" && !state.part && (
          <Banner kind="info">Warten auf den nächsten Spielteil…</Banner>
        )}

        {state.part && state.role === "leit" && <LeitPanel token={token!} part={state.part} reload={load} />}
        {state.part && state.role === "trupp" && (
          <TruppPanel
            token={token!}
            part={state.part}
            submitting={submitting}
            setSubmitting={setSubmitting}
            reload={load}
          />
        )}
      </Page>
    </>
  );
}

function LeitPanel({ token, part, reload }: { token: string; part: any; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const ft = getFeGameType(part.type);

  const startTx = async () => {
    setBusy(true);
    try {
      await api.post(`/api/station/${token}/start`);
      reload();
    } finally {
      setBusy(false);
    }
  };

  if (part.ready === false) {
    return (
      <Banner kind="info">
        Warte auf die vorherige Gruppe in der Kette – sobald sie ihre Nachricht abgegeben hat, kannst du senden.
      </Banner>
    );
  }

  if (!part.startedAt) {
    return (
      <div className="card text-center space-y-5 py-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mx-auto">
          <BroadcastIcon size={30} />
        </div>
        <h2 className="text-2xl font-bold">{part.label}</h2>
        <p className="text-slate-600 max-w-md mx-auto">
          Bereit zur Übertragung. Mit „Übertragung starten" wird die Vorlage aufgedeckt und der Timer läuft.
          Gib die Aufgabe danach über Funk durch.
        </p>
        <button className="btn-primary text-lg px-8 w-full sm:w-auto" disabled={busy} onClick={startTx}>
          <BroadcastIcon size={20} />
          Übertragung starten
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <h2 className="font-bold">{part.label} — Sendebild</h2>
        <div className="text-lg"><Timer startedAt={part.startedAt} /></div>
      </div>
      <div className="card overflow-auto">
        {ft && part.payload ? <ft.LeitView payload={part.payload} token={token} /> : <p>Vorlage wird geladen…</p>}
      </div>
      <Banner kind="info">Gib die Vorlage exakt über Funk durch. Buchstabieren nicht vergessen.</Banner>
    </div>
  );
}

function TruppPanel({
  token,
  part,
  submitting,
  setSubmitting,
  reload,
}: {
  token: string;
  part: any;
  submitting: boolean;
  setSubmitting: (b: boolean) => void;
  reload: () => void;
}) {
  const ft = getFeGameType(part.type);
  const [result, setResult] = useState<any>(part.lastResult ?? null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setResult(part.lastResult ?? null);
  }, [part.roundId, part.lastResult]);

  const submit = async (answer: unknown) => {
    setErr(null);
    setSubmitting(true);
    try {
      const r = await api.post<any>(`/api/station/${token}/submit`, { answer });
      setResult(r);
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!part.startedAt) {
    return <Banner kind="info">Warte auf den Funkspruch der Leitstation… (Aufbau beginnt, sobald gesendet wird)</Banner>;
  }

  if (result) {
    return (
      <div className="card text-center space-y-3 py-7">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage/30 text-emerald-700 mx-auto">
          <CheckIcon size={26} />
        </div>
        <h2 className="text-xl font-bold">Abgegeben</h2>
        <div className="text-5xl font-extrabold text-brand">{Math.round(result.accuracy * 100)}%</div>
        <p className="text-slate-600">
          Zeit {fmt(result.durationMs)} · Punkte {Number(result.score).toFixed(2)}
        </p>
        {result.detail?.heatmap && (
          <p className="text-sm text-slate-500">
            {result.detail.correct}/{result.detail.total} Felder korrekt
          </p>
        )}
        <Banner kind="info">Warten auf den nächsten Spielteil…</Banner>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <h2 className="font-bold">{part.label} — Empfangsbild</h2>
        <div className="text-lg"><Timer startedAt={part.startedAt} /></div>
      </div>
      {err && <Banner kind="warn">{err}</Banner>}
      {ft ? (
        <ft.TruppView config={part.config} onSubmit={submit} submitting={submitting} lastResult={result} />
      ) : (
        <Banner kind="warn">Unbekannter Spieltyp: {part.type}</Banner>
      )}
    </div>
  );
}

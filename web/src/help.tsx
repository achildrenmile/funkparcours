import { useEffect, useState } from "react";
import { HelpIcon, CrossIcon } from "./icons";

export type HelpTopic =
  | "home"
  | "admin-config"
  | "admin-dashboard"
  | "admin-links"
  | "leit"
  | "trupp"
  | "super";

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="text-sm text-slate-600 space-y-1.5 leading-relaxed">{children}</div>
    </section>
  );
}
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-600">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

const KERN = (
  <S title="Grundprinzip">
    <p>
      Das <b>Funkgerät ist der Kanal</b> – die Plattform überträgt die Aufgabe nie selbst. Sie zeigt nur
      die Vorlage, prüft den Nachbau und wertet. Leitstation und Empfangstrupp sehen <b>nie</b> denselben
      Bildschirm.
    </p>
  </S>
);

export const HELP: Record<HelpTopic, { title: string; body: React.ReactNode }> = {
  home: {
    title: "Übungsleitung – Start",
    body: (
      <>
        {KERN}
        <S title="Neues Spiel / Anmelden">
          <p>
            <b>Neues Spiel</b>: Titel + Admin-Passwort vergeben → du bekommst einen Spiel-Code.{" "}
            <b>Anmelden</b>: mit Code + Passwort in ein bestehendes Spiel zurück.
          </p>
          <p>
            Gemerkte Runden erscheinen unter „Meine Spielrunden" (nur auf diesem Gerät) – ein Tipp öffnet sie
            wieder.
          </p>
        </S>
      </>
    ),
  },
  "admin-config": {
    title: "Konfiguration",
    body: (
      <>
        {KERN}
        <S title="Ablauf">
          <Steps
            items={[
              "Funkgruppen anlegen (pro Gruppe je eine Leitstation + ein Empfangstrupp).",
              "Spielteile hinzufügen (Symbolkarte, NATO, Meldung, Koordinaten, Zahlen/Frequenzen, Buchstabieren aktiv, Uhrzeit/Datum, Funkspruch-Lückentext, Lageskizze, Reihenfolge, Funk-Theorie-Quiz, Relais/Stille Post, Störfunk/Mithören) und je Typ konfigurieren.",
              "Wertungsmodus + Anti-Cheat wählen, dann Speichern.",
              "Über „Stationen & Links“ die Zugänge verteilen.",
              "„Spiel starten“ → Live-Dashboard.",
            ]}
          />
        </S>
        <S title="Wertungsmodi">
          <p>
            <b>Zeit</b>: Schnellster gewinnt. <b>Genauigkeits-Gate</b>: Mindestgenauigkeit nötig, dann nach
            Zeit. <b>Gewichtet</b>: Genauigkeit × Tempo kombiniert. <b>Rangpunkte</b>: Punkte je Platz pro
            Runde, summiert.
          </p>
        </S>
        <S title="Anti-Cheat">
          <p>
            <b>Eigene Vorlage je Gruppe</b> (empfohlen): jede Gruppe bekommt eine andere Vorlage gleicher
            Schwierigkeit – auf derselben Frequenz kann man nichts abschreiben. <b>Gleiche für alle</b>: fairer
            Direktvergleich.
          </p>
        </S>
      </>
    ),
  },
  "admin-dashboard": {
    title: "Live-Dashboard",
    body: (
      <>
        <S title="Was du siehst">
          <p>
            Pro Gruppe der Status (<b>wartet</b> / <b>sendet</b> / <b>abgegeben</b>), Genauigkeit und Zeit,
            dazu Leaderboard pro Spielteil und gesamt – alles live.
          </p>
        </S>
        <S title="Steuerung">
          <p>
            <b>Nächster Spielteil</b> schaltet alle Gruppen weiter, <b>Beenden</b> schließt das Spiel.{" "}
            <b>Stationen &amp; Links</b> zeigt die Zugänge, <b>CSV-Export</b> die Endwertung.
          </p>
        </S>
      </>
    ),
  },
  "admin-links": {
    title: "Stationen & Links",
    body: (
      <>
        <S title="Verteilen">
          <p>
            Jede Gruppe hat zwei Zugänge: <b>Sender</b> (Leitstation) und <b>Empfänger</b> (Empfangstrupp).
            Über die Tabs nur die jeweilige Rolle anzeigen.
          </p>
          <p>
            Per <b>Kopieren</b>/<b>Teilen</b> an die Person schicken oder <b>Drucken</b> (ein Blatt mit allen
            QR-Codes zum Aushändigen).
          </p>
        </S>
        <S title="Wichtig">
          <p>
            Sender-Link an die Leitstation, Empfänger-Link an den Trupp – nicht vertauschen. Wer den Link hat,
            ist ohne weiteres Login als diese Rolle drin.
          </p>
        </S>
      </>
    ),
  },
  leit: {
    title: "Leitstation (Sendebild)",
    body: (
      <>
        {KERN}
        <S title="Deine Aufgabe">
          <Steps
            items={[
              "Warte, bis die Übungsleitung das Spiel startet.",
              "„Übertragung starten“ drücken → die Vorlage wird aufgedeckt und der Timer läuft.",
              "Gib die Aufgabe exakt über Funk durch – buchstabieren, Felder benennen (z.B. „B3: rotes Dreieck“).",
              "Der Empfangstrupp baut nach. Deinen Bildschirm dabei niemandem zeigen.",
            ]}
          />
        </S>
        <S title="Tipp">
          <p>Der Timer läuft ab dem Aufdecken – erst starten, wenn du wirklich sendebereit bist.</p>
        </S>
      </>
    ),
  },
  trupp: {
    title: "Empfangstrupp (Empfangsbild)",
    body: (
      <>
        {KERN}
        <S title="Deine Aufgabe">
          <Steps
            items={[
              "Höre den Funkspruch der Leitstation mit.",
              "Baue die Aufgabe am Bildschirm nach: Symbole ziehen/antippen, Felder anklicken bzw. Text eintippen.",
              "„Abgeben“ drücken, wenn fertig – die Abgabe ist endgültig.",
              "Du bekommst sofort Genauigkeit + Zeit; dann auf den nächsten Spielteil warten.",
            ]}
          />
        </S>
        <S title="Tipp">
          <p>Die Zeit zählt ab dem Funkspruch – genau zuhören und rückfragen ist erlaubt, kostet aber Zeit.</p>
        </S>
      </>
    ),
  },
  super: {
    title: "Superadmin",
    body: (
      <>
        <S title="Übersicht">
          <p>
            Sieht <b>alle</b> Spiele und Datenbankeinträge: Stats oben, Tabelle darunter. Zeile antippen
            klappt Details auf (Gruppen, Tokens, Runden, Abgaben, Events).
          </p>
        </S>
        <S title="Verwalten">
          <p>
            <b>Verwalten</b> öffnet ein Spiel in voller Admin-Ansicht – ohne dessen Passwort. Damit kannst du
            im Zweifel alles steuern (konfigurieren, starten, Dashboard, Links).
          </p>
          <p>Das „×" löscht ein Spiel inklusive aller zugehörigen Daten (unwiderruflich).</p>
        </S>
      </>
    ),
  },
};

export function HelpButton({ topic, autoOpenOnce }: { topic: HelpTopic; autoOpenOnce?: boolean }) {
  const [open, setOpen] = useState(false);
  const entry = HELP[topic];

  useEffect(() => {
    if (!autoOpenOnce) return;
    const key = `fp_help_seen_${topic}`;
    try {
      if (!localStorage.getItem(key)) {
        setOpen(true);
        localStorage.setItem(key, "1");
      }
    } catch {
      /* ignore */
    }
  }, [autoOpenOnce, topic]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Hilfe"
        title="Hilfe"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/90 hover:bg-white/10 transition"
      >
        <HelpIcon size={20} />
        <span className="hidden sm:inline">Hilfe</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-[slidein_.15s_ease-out]">
            <div className="sticky top-0 bg-ink text-white px-4 h-14 flex items-center justify-between">
              <span className="font-semibold">{entry.title}</span>
              <button onClick={() => setOpen(false)} aria-label="Schließen" className="p-1 hover:bg-white/10 rounded">
                <CrossIcon size={20} />
              </button>
            </div>
            <div className="p-4 space-y-5">
              <img
                src="/funkparcours-hero.png"
                alt="FunkParcours"
                className="w-full rounded-xl border border-slate-200 shadow-sm"
                loading="lazy"
              />
              {entry.body}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

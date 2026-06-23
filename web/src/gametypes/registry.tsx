import type React from "react";
import { SymbolkarteLeit, SymbolkarteTrupp } from "./symbolkarte";
import { SymbolkarteConfigForm } from "./symbolkarteConfig";
import { NatoLeit, NatoTrupp, NatoConfigForm } from "./nato";
import { MeldungLeit, MeldungTrupp, MeldungConfigForm } from "./meldung";
import { KoordinatenLeit, KoordinatenTrupp, KoordinatenConfigForm } from "./koordinaten";
import { ZahlenLeit, ZahlenTrupp, ZahlenConfigForm } from "./zahlen";
import { EncodeLeit, EncodeTrupp, EncodeConfigForm } from "./encode";
import { ZeitLeit, ZeitTrupp, ZeitConfigForm } from "./zeit";
import { SpruchLeit, SpruchTrupp, SpruchConfigForm } from "./spruch";
import { SkizzeLeit, SkizzeTrupp, SkizzeConfigForm } from "./skizze";
import { ReihenfolgeLeit, ReihenfolgeTrupp, ReihenfolgeConfigForm } from "./reihenfolge";
import { QuizLeit, QuizTrupp, QuizConfigForm } from "./quiz";
import { RelaisLeit, RelaisTrupp, RelaisConfigForm } from "./relais";
import { StoerfunkLeit, StoerfunkTrupp, StoerfunkConfigForm } from "./stoerfunk";

export interface LeitViewProps {
  payload: any;
  /** station token — needed by views that fetch from a station endpoint (e.g. Störfunk audio) */
  token?: string;
}
export interface TruppViewProps {
  config: any;
  onSubmit: (answer: unknown) => void;
  submitting: boolean;
  lastResult: { accuracy: number; durationMs: number; score: number; detail: any } | null;
}
export interface ConfigFormProps {
  config: any;
  onChange: (c: any) => void;
}

export interface FeGameType {
  id: string;
  label: string;
  /** one-line explanation shown in the admin config */
  description: string;
  defaultConfig: Record<string, unknown>;
  LeitView: React.FC<LeitViewProps>;
  TruppView: React.FC<TruppViewProps>;
  ConfigForm: React.FC<ConfigFormProps>;
}

const REGISTRY: Record<string, FeGameType> = {
  symbolkarte: {
    id: "symbolkarte",
    label: "Symbolkarte",
    description:
      "Symbolraster merken: Leitstation beschreibt Form + Farbe je Feld, der Trupp baut das Gitter nach.",
    defaultConfig: {
      rows: 5,
      cols: 5,
      shapes: ["kreis", "dreieck", "quadrat", "stern"],
      colors: ["rot", "blau", "gruen", "gelb"],
      symbolCount: 6,
      stacking: false,
      maxStack: 3,
    },
    LeitView: SymbolkarteLeit,
    TruppView: SymbolkarteTrupp,
    ConfigForm: SymbolkarteConfigForm,
  },
  nato: {
    id: "nato",
    label: "Buchstabieren (NATO)",
    description:
      "Buchstabieren hören: Leitstation buchstabiert Wörter/Rufzeichen phonetisch, der Trupp schreibt die Buchstaben.",
    defaultConfig: { mode: "mix", count: 4, minLen: 4, maxLen: 7, showReference: true },
    LeitView: NatoLeit,
    TruppView: NatoTrupp,
    ConfigForm: NatoConfigForm,
  },
  meldung: {
    id: "meldung",
    label: "Meldung",
    description:
      "Strukturierte Meldung aufnehmen: Leitstation gibt Felder (Von, An, Ort, Lage …) durch, der Trupp trägt sie ein.",
    defaultConfig: {
      fields: ["von", "an", "ort", "lage", "anzahl_personen", "prioritaet"],
      fuzzy: true,
      fuzzyThreshold: 0.8,
    },
    LeitView: MeldungLeit,
    TruppView: MeldungTrupp,
    ConfigForm: MeldungConfigForm,
  },
  koordinaten: {
    id: "koordinaten",
    label: "Koordinaten",
    description:
      "Koordinaten markieren: Leitstation nennt Gitterfelder (z.B. C5), der Trupp klickt sie an.",
    defaultConfig: { rows: 8, cols: 8, markerCount: 5 },
    LeitView: KoordinatenLeit,
    TruppView: KoordinatenTrupp,
    ConfigForm: KoordinatenConfigForm,
  },
  zahlen: {
    id: "zahlen",
    label: "Zahlen / Frequenzen",
    description:
      "Zahlen übertragen: Leitstation liest Ziffernblöcke/Frequenzen/Kanäle, der Trupp tippt sie zurück.",
    defaultConfig: { mode: "mix", count: 5, groupSize: 4, showSpelling: true },
    LeitView: ZahlenLeit,
    TruppView: ZahlenTrupp,
    ConfigForm: ZahlenConfigForm,
  },
  encode: {
    id: "encode",
    label: "Buchstabieren aktiv (NATO)",
    description:
      "Buchstabieren aktiv: Leitstation liest ein Klartextwort, der Trupp buchstabiert es im NATO-Alphabet zurück.",
    defaultConfig: { mode: "mix", count: 4, minLen: 4, maxLen: 7, showReference: true },
    LeitView: EncodeLeit,
    TruppView: EncodeTrupp,
    ConfigForm: EncodeConfigForm,
  },
  zeit: {
    id: "zeit",
    label: "Uhrzeit / Datum",
    description:
      "Uhrzeit/Datum im Funkformat: Leitstation liest Zeiten/Daten (14:32, 15.06.), der Trupp tippt sie zurück.",
    defaultConfig: { mode: "mix", count: 5 },
    LeitView: ZeitLeit,
    TruppView: ZeitTrupp,
    ConfigForm: ZeitConfigForm,
  },
  spruch: {
    id: "spruch",
    label: "Funkspruch (Lückentext)",
    description:
      "Lückentext: Leitstation liest komplette Funksprüche, der Trupp füllt nur die Lücken aus.",
    defaultConfig: { templateIds: ["ruf", "standort", "lage", "personen"], fuzzy: true, fuzzyThreshold: 0.8 },
    LeitView: SpruchLeit,
    TruppView: SpruchTrupp,
    ConfigForm: SpruchConfigForm,
  },
  skizze: {
    id: "skizze",
    label: "Lageskizze",
    description:
      "Lageskizze: Leitstation beschreibt Pfeile/Gefahr/Sammelplatz/Ziel auf einem Gitter, der Trupp baut die Karte nach.",
    defaultConfig: { rows: 6, cols: 6, count: 5 },
    LeitView: SkizzeLeit,
    TruppView: SkizzeTrupp,
    ConfigForm: SkizzeConfigForm,
  },
  reihenfolge: {
    id: "reihenfolge",
    label: "Reihenfolge",
    description:
      "Reihenfolge/Marschtabelle: Leitstation gibt die richtige Reihenfolge durch, der Trupp sortiert die Einträge.",
    defaultConfig: { items: ["Sammelplatz", "Brücke Nord", "Bahnhof", "Kreuzung B1", "Funkmast", "Ziel Waldweg"] },
    LeitView: ReihenfolgeLeit,
    TruppView: ReihenfolgeTrupp,
    ConfigForm: ReihenfolgeConfigForm,
  },
  quiz: {
    id: "quiz",
    label: "Funk-Theorie (Quiz)",
    description:
      "Theorie-Quiz: Leitstation liest Frage + Antworten A–D vor, der Trupp wählt den gehörten Buchstaben.",
    defaultConfig: { count: 5 },
    LeitView: QuizLeit,
    TruppView: QuizTrupp,
    ConfigForm: QuizConfigForm,
  },
  relais: {
    id: "relais",
    label: "Relais (Stille Post)",
    description:
      "Stille Post: Eine Nachricht wandert durch die Gruppenkette (Gruppe 1→2→3…); jede Gruppe wird gegen das Original gewertet.",
    defaultConfig: { length: "normal" },
    LeitView: RelaisLeit,
    TruppView: RelaisTrupp,
    ConfigForm: RelaisConfigForm,
  },
  stoerfunk: {
    id: "stoerfunk",
    label: "Störfunk (Mithören)",
    description:
      "Störfunk: Plattform erzeugt verrauschtes Audio, Leitstation spielt es über Funk, der Trupp schreibt mit.",
    defaultConfig: { length: "kurz", noise: 0.4 },
    LeitView: StoerfunkLeit,
    TruppView: StoerfunkTrupp,
    ConfigForm: StoerfunkConfigForm,
  },
};

export function getFeGameType(id: string): FeGameType | undefined {
  return REGISTRY[id];
}

export function listFeGameTypes(): FeGameType[] {
  return Object.values(REGISTRY);
}

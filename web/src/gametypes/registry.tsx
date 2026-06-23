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

export interface LeitViewProps {
  payload: any;
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
  defaultConfig: Record<string, unknown>;
  LeitView: React.FC<LeitViewProps>;
  TruppView: React.FC<TruppViewProps>;
  ConfigForm: React.FC<ConfigFormProps>;
}

const REGISTRY: Record<string, FeGameType> = {
  symbolkarte: {
    id: "symbolkarte",
    label: "Symbolkarte",
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
    defaultConfig: { mode: "mix", count: 4, minLen: 4, maxLen: 7, showReference: true },
    LeitView: NatoLeit,
    TruppView: NatoTrupp,
    ConfigForm: NatoConfigForm,
  },
  meldung: {
    id: "meldung",
    label: "Meldung",
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
    defaultConfig: { rows: 8, cols: 8, markerCount: 5 },
    LeitView: KoordinatenLeit,
    TruppView: KoordinatenTrupp,
    ConfigForm: KoordinatenConfigForm,
  },
  zahlen: {
    id: "zahlen",
    label: "Zahlen / Frequenzen",
    defaultConfig: { mode: "mix", count: 5, groupSize: 4, showSpelling: true },
    LeitView: ZahlenLeit,
    TruppView: ZahlenTrupp,
    ConfigForm: ZahlenConfigForm,
  },
  encode: {
    id: "encode",
    label: "Buchstabieren aktiv (NATO)",
    defaultConfig: { mode: "mix", count: 4, minLen: 4, maxLen: 7, showReference: true },
    LeitView: EncodeLeit,
    TruppView: EncodeTrupp,
    ConfigForm: EncodeConfigForm,
  },
  zeit: {
    id: "zeit",
    label: "Uhrzeit / Datum",
    defaultConfig: { mode: "mix", count: 5 },
    LeitView: ZeitLeit,
    TruppView: ZeitTrupp,
    ConfigForm: ZeitConfigForm,
  },
  spruch: {
    id: "spruch",
    label: "Funkspruch (Lückentext)",
    defaultConfig: { templateIds: ["ruf", "standort", "lage", "personen"], fuzzy: true, fuzzyThreshold: 0.8 },
    LeitView: SpruchLeit,
    TruppView: SpruchTrupp,
    ConfigForm: SpruchConfigForm,
  },
  skizze: {
    id: "skizze",
    label: "Lageskizze",
    defaultConfig: { rows: 6, cols: 6, count: 5 },
    LeitView: SkizzeLeit,
    TruppView: SkizzeTrupp,
    ConfigForm: SkizzeConfigForm,
  },
  reihenfolge: {
    id: "reihenfolge",
    label: "Reihenfolge",
    defaultConfig: { items: ["Sammelplatz", "Brücke Nord", "Bahnhof", "Kreuzung B1", "Funkmast", "Ziel Waldweg"] },
    LeitView: ReihenfolgeLeit,
    TruppView: ReihenfolgeTrupp,
    ConfigForm: ReihenfolgeConfigForm,
  },
};

export function getFeGameType(id: string): FeGameType | undefined {
  return REGISTRY[id];
}

export function listFeGameTypes(): FeGameType[] {
  return Object.values(REGISTRY);
}

import type React from "react";
import { SymbolkarteLeit, SymbolkarteTrupp } from "./symbolkarte";
import { SymbolkarteConfigForm } from "./symbolkarteConfig";
import { NatoLeit, NatoTrupp, NatoConfigForm } from "./nato";
import { MeldungLeit, MeldungTrupp, MeldungConfigForm } from "./meldung";
import { KoordinatenLeit, KoordinatenTrupp, KoordinatenConfigForm } from "./koordinaten";

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
};

export function getFeGameType(id: string): FeGameType | undefined {
  return REGISTRY[id];
}

export function listFeGameTypes(): FeGameType[] {
  return Object.values(REGISTRY);
}

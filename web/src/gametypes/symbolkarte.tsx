import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SymbolGlyph,
  StackView,
  COLOR_LABEL,
  SHAPE_LABEL,
  type Sym,
  type Shape,
  type Color,
} from "./symbolGlyph";
import type { LeitViewProps, TruppViewProps } from "./registry";
import { MinusIcon } from "../icons";

const ALPHA = "ABCDEFGHIJKL";
const colLabels = (n: number) => Array.from({ length: n }, (_, i) => ALPHA[i]);
const rowLabels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const key = (c: string, r: string) => `${c}${r}`;

function GridFrame({
  cols,
  rows,
  renderCell,
}: {
  cols: string[];
  rows: string[];
  renderCell: (k: string) => React.ReactNode;
}) {
  return (
    <div className="inline-block overflow-auto max-w-full">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `1.5rem repeat(${cols.length}, minmax(2.75rem, 1fr))` }}
      >
        <div />
        {cols.map((c) => (
          <div key={c} className="text-center text-xs font-bold text-slate-500">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <FragmentRow key={r} r={r} cols={cols} renderCell={renderCell} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({
  r,
  cols,
  renderCell,
}: {
  r: string;
  cols: string[];
  renderCell: (k: string) => React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-bold text-slate-500">{r}</div>
      {cols.map((c) => (
        <div key={c}>{renderCell(key(c, r))}</div>
      ))}
    </>
  );
}

// ---------- Leit (read-only template) ----------
export function SymbolkarteLeit({ payload }: LeitViewProps) {
  const cols: string[] = payload.colLabels;
  const rows: string[] = payload.rowLabels;
  const cells: Record<string, Sym[]> = payload.cells ?? {};
  return (
    <GridFrame
      cols={cols}
      rows={rows}
      renderCell={(k) => (
        <div className="aspect-square rounded-md bg-slate-50 border border-slate-200 flex items-start justify-center p-1 min-h-[3rem]">
          <StackView stack={cells[k] ?? []} />
        </div>
      )}
    />
  );
}

// ---------- Trupp (interactive rebuild) ----------
function PaletteItem({ sym }: { sym: Sym }) {
  const id = `pal:${sym.shape}:${sym.color}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { sym } });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 bg-white touch-none ${
        isDragging ? "opacity-30" : "hover:bg-slate-50"
      }`}
      title={`${COLOR_LABEL[sym.color]} ${SHAPE_LABEL[sym.shape]}`}
    >
      <SymbolGlyph shape={sym.shape} color={sym.color} size={30} />
    </button>
  );
}

function DropCell({
  k,
  stack,
  onTap,
  onRemove,
}: {
  k: string;
  stack: Sym[];
  onTap: (k: string) => void;
  onRemove: (k: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${k}`, data: { k } });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onTap(k)}
      className={`relative aspect-square rounded-md border flex items-start justify-center p-1 min-h-[3.25rem] cursor-pointer select-none ${
        isOver ? "border-brand ring-2 ring-brand/30 bg-brand/5" : "border-slate-300 bg-white hover:bg-slate-50"
      }`}
    >
      <StackView stack={stack} />
      {stack.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(k);
          }}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-ink text-white inline-flex items-center justify-center shadow"
          title="oberstes entfernen"
        >
          <MinusIcon size={12} />
        </button>
      )}
    </div>
  );
}

export function SymbolkarteTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const cols = useMemo(() => colLabels(config.cols ?? 5), [config.cols]);
  const rows = useMemo(() => rowLabels(config.rows ?? 5), [config.rows]);
  const shapes: Shape[] = config.shapes ?? ["kreis", "dreieck", "quadrat", "stern"];
  const colors: Color[] = config.colors ?? ["rot", "blau", "gruen", "gelb"];
  const stacking: boolean = config.stacking ?? false;
  const maxStack: number = stacking ? (config.maxStack ?? 3) : 1;

  const [cells, setCells] = useState<Record<string, Sym[]>>({});
  const [active, setActive] = useState<Sym | null>(null);
  const [selected, setSelected] = useState<Sym | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );

  const palette: Sym[] = [];
  for (const c of colors) for (const s of shapes) palette.push({ shape: s, color: c });

  const place = (k: string, sym: Sym) => {
    setCells((prev) => {
      const cur = prev[k] ?? [];
      if (cur.length >= maxStack) return prev;
      return { ...prev, [k]: [...cur, sym] };
    });
  };
  const removeTop = (k: string) =>
    setCells((prev) => {
      const cur = prev[k] ?? [];
      const next = cur.slice(0, -1);
      const copy = { ...prev };
      if (next.length) copy[k] = next;
      else delete copy[k];
      return copy;
    });

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const sym = e.active.data.current?.sym as Sym | undefined;
    const k = e.over?.data.current?.k as string | undefined;
    if (sym && k) place(k, sym);
  };

  const tapCell = (k: string) => {
    if (selected) place(k, selected);
  };

  const locked = lastResult != null;

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActive((e.active.data.current?.sym as Sym) ?? null)}
        onDragEnd={onDragEnd}
      >
        <GridFrame
          cols={cols}
          rows={rows}
          renderCell={(k) => (
            <DropCell
              k={k}
              stack={cells[k] ?? []}
              onTap={locked ? () => {} : tapCell}
              onRemove={locked ? () => {} : removeTop}
            />
          )}
        />

        {!locked && (
          <div className="card">
            <p className="text-sm text-slate-500 mb-2">
              Symbol auf ein Feld <b>ziehen</b> — oder antippen zum Auswählen, dann Feld antippen.
              {stacking && <> Stapeln bis {maxStack} (Reihenfolge zählt, unterstes zuerst).</>}
            </p>
            <div className="flex flex-wrap gap-2">
              {palette.map((sym) => (
                <div
                  key={`${sym.shape}:${sym.color}`}
                  onClick={() =>
                    setSelected((s) =>
                      s && s.shape === sym.shape && s.color === sym.color ? null : sym,
                    )
                  }
                  className={`rounded-lg ${
                    selected && selected.shape === sym.shape && selected.color === sym.color
                      ? "ring-2 ring-funk-600"
                      : ""
                  }`}
                >
                  <PaletteItem sym={sym} />
                </div>
              ))}
            </div>
          </div>
        )}

        <DragOverlay>
          {active ? <SymbolGlyph shape={active.shape} color={active.color} size={34} /> : null}
        </DragOverlay>
      </DndContext>

      {!locked && (
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setCells({})}>
            Zurücksetzen
          </button>
          <button
            className="btn-primary flex-1"
            disabled={submitting}
            onClick={() => onSubmit({ cells })}
          >
            {submitting ? "Sende…" : "Abgeben"}
          </button>
        </div>
      )}
    </div>
  );
}

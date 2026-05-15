import { ShapeMark } from "./ShapePicker";
import { distinctValues, markerColor, markerShape } from "../lib/pins";
import type { ConfirmedMapping, Outlet, OutletValidation } from "../types";
import type React from "react";
import { useState } from "react";

interface MapLegendProps {
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
  mapping: ConfirmedMapping;
}

export function MapLegend({ outlets, validations, mapping }: MapLegendProps) {
  const [open, setOpen] = useState(false);
  const colorItems = mapping.colorByField
    ? distinctValues(outlets, mapping.colorByField).map((value) => ({
        label: value,
        color: markerColor(outlets.find((outlet) => String(outlet.originalData[mapping.colorByField] ?? "") === value) ?? outlets[0], mapping)
      }))
    : [
        { label: "Reviewed", color: "#16a34a" },
        { label: "Unreviewed", color: "#F40009" }
      ];

  const shapeItems = mapping.shapeByField
    ? distinctValues(outlets, mapping.shapeByField).map((value) => ({
        label: value,
        shape: markerShape(outlets.find((outlet) => String(outlet.originalData[mapping.shapeByField] ?? "") === value) ?? outlets[0], mapping)
      }))
    : [{ label: "Outlet marker", shape: "circle" }];

  return (
    <div className="absolute bottom-4 left-4 z-[500] grid w-[min(20rem,calc(100%-2rem))] justify-items-start gap-2 text-xs">
      {open ? (
        <section
          aria-label="Map legend"
          className="grid max-h-52 w-full gap-3 overflow-y-auto rounded-md border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-950">Legend</h3>
            <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-400">{outlets.length} shown</span>
          </div>
          <LegendGroup title={mapping.colorByField ? `Colors: ${mapping.colorByField}` : "Colors: review status"}>
            {colorItems.slice(0, 12).map((item) => (
              <div key={item.label} className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full border border-white shadow" style={{ background: item.color }} />
                <span className="truncate text-slate-700">{item.label}</span>
              </div>
            ))}
          </LegendGroup>
          <LegendGroup title={mapping.shapeByField ? `Shapes: ${mapping.shapeByField}` : "Shapes: default"}>
            {shapeItems.slice(0, 12).map((item) => (
              <div key={item.label} className="flex min-w-0 items-center gap-2">
                <ShapeMark shape={item.shape} color="#334155" className="scale-50" />
                <span className="truncate text-slate-700">{item.label}</span>
              </div>
            ))}
          </LegendGroup>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-coke focus:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide legend" : "Show legend"}
      </button>
    </div>
  );
}

function LegendGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="grid gap-1.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

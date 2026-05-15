import { pinShapes } from "../lib/pins";
import { cn } from "../lib/utils";
import type React from "react";

interface ShapePickerProps {
  label: string;
  value: string;
  onChange: (shape: string) => void;
}

export function ShapePicker({ label, value, onChange }: ShapePickerProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {pinShapes.map((shape) => (
        <button
          key={shape}
          type="button"
          aria-pressed={value === shape}
          aria-label={`Set ${label} to ${shape}`}
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold capitalize transition focus:outline-none focus:ring-2 focus:ring-coke focus:ring-offset-2",
            value === shape ? "border-coke bg-red-50 text-coke" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          )}
          onClick={() => onChange(shape)}
        >
          <ShapeMark shape={shape} />
          {shape}
        </button>
      ))}
    </div>
  );
}

export function ShapeMark({ shape, color = "#F40009", className = "" }: { shape: string; color?: string; className?: string }) {
  return <span aria-hidden="true" className={cn("pin-shape scale-75", `pin-${shape}`, className)} style={{ background: color, "--pin-color": color } as React.CSSProperties} />;
}

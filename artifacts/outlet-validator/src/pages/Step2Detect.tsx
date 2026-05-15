import { useMemo } from "react";
import { Badge, Button, Panel } from "../components/ui";
import { detectRequiredColumns } from "../lib/schema-detect";
import { useOutletStore } from "../store";

export function Step2Detect() {
  const { rawHeaders, confirmedMapping, setConfirmedMapping, setStep } = useOutletStore();
  const detected = useMemo(() => detectRequiredColumns(rawHeaders), [rawHeaders]);
  const allDetected = detected.id && detected.lat && detected.lng;

  function continueToMapping() {
    setConfirmedMapping({ ...confirmedMapping, ...detected });
    setStep(3);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Detect required columns</h2>
          <p className="mt-1 text-sm text-slate-500">Confirm the core fields before mapping.</p>
        </div>
        {[
          ["Outlet ID", detected.id],
          ["Latitude", detected.lat],
          ["Longitude", detected.lng]
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
            <span className="font-medium text-slate-800">{label}</span>
            {value ? <Badge tone="success">{value}</Badge> : <Badge tone="warning">Missing</Badge>}
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={continueToMapping}>{allDetected ? "Continue" : "Review Mappings"}</Button>
        </div>
      </Panel>
    </div>
  );
}

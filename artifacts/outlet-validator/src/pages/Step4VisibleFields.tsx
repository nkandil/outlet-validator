import { useEffect, useMemo } from "react";
import { Button, Checkbox, Panel } from "../components/ui";
import { useOutletStore } from "../store";

export function Step4VisibleFields() {
  const { rawHeaders, confirmedMapping, visibleFields, setVisibleFields, setStep } = useOutletStore();
  const available = useMemo(() => rawHeaders.filter((field) => ![confirmedMapping.id, confirmedMapping.lat, confirmedMapping.lng].includes(field)), [rawHeaders, confirmedMapping]);

  useEffect(() => {
    if (available.length && visibleFields.length === 0) setVisibleFields(available);
  }, [available, setVisibleFields, visibleFields.length]);

  const selected = new Set(visibleFields);

  function toggle(field: string) {
    setVisibleFields(selected.has(field) ? visibleFields.filter((item) => item !== field) : [...visibleFields, field]);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Visible outlet fields</h2>
          <p className="mt-1 text-sm text-slate-500">Choose fields shown on outlet cards and in the review overlay.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setVisibleFields(available)}>
            Select all
          </Button>
          <Button variant="secondary" onClick={() => setVisibleFields([])}>
            Deselect all
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((field) => (
            <label key={field} className="flex min-h-11 items-center gap-3 rounded-md border bg-card p-3 text-sm font-medium">
              <Checkbox checked={selected.has(field)} onChange={() => toggle(field)} />
              {field}
            </label>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setStep(3)}>
            Back
          </Button>
          <Button disabled={available.length > 0 && visibleFields.length === 0} onClick={() => setStep(5)}>
            Continue
          </Button>
        </div>
      </Panel>
    </div>
  );
}

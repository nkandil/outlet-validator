import { useMemo, useState } from "react";
import { ShapePicker } from "../components/ShapePicker";
import { Badge, Button, Field, Input, Panel, Select } from "../components/ui";
import { sessionsApi } from "../lib/api";
import { buildOutlets, duplicateIds } from "../lib/geo";
import { distinctValues, pinShapes, presetColors } from "../lib/pins";
import { useOutletStore } from "../store";

export function Step3MapFields() {
  const state = useOutletStore();
  const [warning, setWarning] = useState("");
  const mapping = state.confirmedMapping;
  const outlets = useMemo(() => buildOutlets(state.rawRows, mapping), [state.rawRows, mapping]);
  const duplicates = duplicateIds(outlets);
  const canContinue = mapping.id && mapping.lat && mapping.lng && outlets.length > 0;
  const availableValues = distinctValues(outlets, mapping.colorByField);
  const shapeValues = distinctValues(outlets, mapping.shapeByField);

  function update(key: keyof typeof mapping, value: string) {
    state.setConfirmedMapping({ ...mapping, [key]: value });
  }

  async function saveAndContinue() {
    const sessionName = state.sessionName || state.fileName || "Outlet validation session";
    state.setOutlets(outlets);
    state.setSyncState("syncing");
    try {
      if (state.sessionId) {
        await sessionsApi.update(state.sessionId, { config: state.getSessionConfig(), outlets, radiusKm: state.radiusKm });
      } else {
        const created = await sessionsApi.create({
          name: sessionName,
          fileName: state.fileName,
          radiusKm: state.radiusKm,
          config: state.getSessionConfig(),
          outlets,
          validations: state.validations
        });
        state.setSessionMeta(created.id, created.name);
      }
      state.setSyncState("synced");
    } catch (err) {
      state.setSyncState("failed", err instanceof Error ? err.message : "Backend unavailable");
      setWarning("Session could not be saved to the backend. You can continue offline.");
    } finally {
      state.setStep(4);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Map fields and pins</h2>
          <p className="mt-1 text-sm text-slate-500">Select required columns and optional map styling fields.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Outlet ID">
            <Select value={mapping.id} onChange={(event) => update("id", event.target.value)}>
              <Options headers={state.rawHeaders} />
            </Select>
          </Field>
          <Field label="Latitude">
            <Select value={mapping.lat} onChange={(event) => update("lat", event.target.value)}>
              <Options headers={state.rawHeaders} />
            </Select>
          </Field>
          <Field label="Longitude">
            <Select value={mapping.lng} onChange={(event) => update("lng", event.target.value)}>
              <Options headers={state.rawHeaders} />
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Display name">
            <Select value={mapping.displayField} onChange={(event) => update("displayField", event.target.value)}>
              <Options headers={state.rawHeaders} includeBlank />
            </Select>
          </Field>
          <Field label="Color pins by">
            <Select value={mapping.colorByField} onChange={(event) => update("colorByField", event.target.value)}>
              <Options headers={state.rawHeaders} includeBlank />
            </Select>
          </Field>
          <Field label="Shape pins by">
            <Select value={mapping.shapeByField} onChange={(event) => update("shapeByField", event.target.value)}>
              <Options headers={state.rawHeaders} includeBlank />
            </Select>
          </Field>
        </div>
        {availableValues.length ? (
          <div className="grid gap-2">
            <h3 className="font-semibold text-slate-900">Pin colors</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableValues.map((value, index) => (
                <label key={value} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-2 text-sm">
                  <span className="truncate">{value}</span>
                  <Input
                    type="color"
                    className="h-11 w-16 p-1"
                    value={mapping.colorByValues[value] ?? presetColors[index % presetColors.length]}
                    onChange={(event) => state.setConfirmedMapping({ ...mapping, colorByValues: { ...mapping.colorByValues, [value]: event.target.value } })}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {shapeValues.length ? (
          <div className="grid gap-2">
            <h3 className="font-semibold text-slate-900">Pin shapes</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {shapeValues.map((value, index) => (
                <div key={value} className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm">
                  <span className="truncate">{value}</span>
                  <ShapePicker
                    label={`${value} shape`}
                    value={mapping.shapeByValues[value] ?? pinShapes[index % pinShapes.length]}
                    onChange={(shape) => state.setConfirmedMapping({ ...mapping, shapeByValues: { ...mapping.shapeByValues, [value]: shape } })}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <Field label="Nearby radius (km)">
          <Input type="number" min={0.1} step={0.1} value={state.radiusKm} onChange={(event) => state.setRadiusKm(Number(event.target.value) || 5)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge tone={outlets.length ? "success" : "warning"}>{outlets.length} valid coordinate rows</Badge>
          {duplicates.length ? <Badge tone="warning">{duplicates.length} duplicate IDs</Badge> : null}
          {warning ? <Badge tone="warning">{warning}</Badge> : null}
        </div>
        <div className="flex justify-end">
          <Button disabled={!canContinue} onClick={saveAndContinue}>
            Continue
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Options({ headers, includeBlank = false }: { headers: string[]; includeBlank?: boolean }) {
  return (
    <>
      {includeBlank ? <option value="">None</option> : <option value="">Select field</option>}
      {headers.map((header) => (
        <option key={header} value={header}>
          {header}
        </option>
      ))}
    </>
  );
}

import { useMemo, useState } from "react";
import { useOptionalAuth } from "../auth";
import type { FieldValidation, Outlet, OutletValidation } from "../types";
import { Button, Field, Textarea } from "../components/ui";
import { haversineKm } from "../lib/geo";
import { asString } from "../lib/utils";
import { useOutletStore } from "../store";

const outletStatuses = ["Valid", "Needs Update", "Invalid", "Duplicate", "Could Not Verify"] as const;
const fieldStatuses = ["Valid", "Invalid", "Not Sure"] as const;

function emptyFieldValidation(): FieldValidation {
  return { status: "", correctedValue: "", comment: "" };
}

function normalizeOutletStatus(status: string): OutletValidation["status"] {
  return (status === "Invalid Lead" ? "Invalid" : status) as OutletValidation["status"];
}

export function Step8OutletReview({ outlet, onSync }: { outlet: Outlet; onSync: (outletKey: string, validation: OutletValidation) => Promise<void> }) {
  const state = useOutletStore();
  const auth = useOptionalAuth();
  const reviewerName = auth?.user?.name ?? state.reviewerName;
  const reviewerId = auth?.user?.id;
  const existing = state.validations[outlet.outletKey];
  const [draft, setDraft] = useState<OutletValidation>(
    existing
      ? { ...existing, status: normalizeOutletStatus(existing.status) }
      : {
          status: "",
          generalComments: "",
          validatedBy: reviewerName,
          validatedAt: "",
          fields: {}
        }
  );
  const displayName = useMemo(() => (state.confirmedMapping.displayField ? asString(outlet.originalData[state.confirmedMapping.displayField]) : ""), [outlet, state.confirmedMapping.displayField]);

  function updateField(field: string, patch: Partial<FieldValidation>) {
    setDraft((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]: { ...(current.fields[field] ?? emptyFieldValidation()), ...patch }
      }
    }));
  }

  function save() {
    const gps = captureGpsEvidence(outlet, state.userLocation);
    const validation = {
      ...draft,
      ...gps,
      validatedBy: reviewerName,
      reviewerId,
      validatedAt: new Date().toISOString()
    };
    state.saveValidationLocal(outlet.outletKey, validation);
    state.selectOutlet(null);
    void onSync(outlet.outletKey, validation);
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:mx-auto sm:max-w-3xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{displayName || outlet.id}</h2>
            <p className="text-sm text-slate-500">
              ID {outlet.id} · {outlet.latitude}, {outlet.longitude}
              {outlet.distanceKm !== null ? ` · ${outlet.distanceKm.toFixed(2)} km` : ""}
            </p>
          </div>
          <Button variant="ghost" onClick={() => state.selectOutlet(null)}>
            Close
          </Button>
        </div>
        <div className="grid gap-4">
          <StatusButtonGroup label="Outlet status" options={outletStatuses} value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as OutletValidation["status"] })} />

          <div className="grid gap-2">
            <h3 className="font-semibold text-slate-900">Visible fields</h3>
            {state.visibleFields.map((field) => (
              <div key={field} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-600">{field}</div>
                <div className="mt-1 break-words text-slate-950">{asString(outlet.originalData[field]) || "-"}</div>
              </div>
            ))}
          </div>

          {state.fieldsToVerify.length ? (
            <div className="grid gap-3">
              <h3 className="font-semibold text-slate-900">Field validation</h3>
              {state.fieldsToVerify.map((field) => {
                const fieldDraft = draft.fields[field] ?? emptyFieldValidation();
                const needsDetail = fieldDraft.status === "Invalid" || fieldDraft.status === "Not Sure";
                return (
                  <div key={field} className="grid gap-3 rounded-md border border-slate-200 p-3">
                    <div>
                      <div className="font-medium text-slate-600">{field}</div>
                      <div className="text-sm text-slate-950">{asString(outlet.originalData[field]) || "-"}</div>
                    </div>
                    <StatusButtonGroup label="Status" options={fieldStatuses} value={fieldDraft.status} onChange={(status) => updateField(field, { status: status as FieldValidation["status"] })} />
                    {needsDetail ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Corrected value">
                          <Textarea value={fieldDraft.correctedValue} onChange={(event) => updateField(field, { correctedValue: event.target.value })} />
                        </Field>
                        <Field label="Comment">
                          <Textarea value={fieldDraft.comment} onChange={(event) => updateField(field, { comment: event.target.value })} />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <Field label="General comments">
            <Textarea value={draft.generalComments} onChange={(event) => setDraft({ ...draft, generalComments: event.target.value })} />
          </Field>
          <Button disabled={!draft.status} onClick={save}>
            Save Review
          </Button>
        </div>
      </section>
    </div>
  );
}

function captureGpsEvidence(outlet: Outlet, location: { latitude: number; longitude: number; accuracyMeters?: number | null; capturedAt?: string } | null): Partial<OutletValidation> {
  if (!location) return {};
  return {
    gpsLatitude: location.latitude,
    gpsLongitude: location.longitude,
    gpsAccuracyMeters: location.accuracyMeters ?? null,
    gpsCapturedAt: location.capturedAt ?? new Date().toISOString(),
    gpsPermissionStatus: "granted",
    distanceToOutletMeters: Math.round(haversineKm(location, { latitude: outlet.latitude, longitude: outlet.longitude }) * 1000)
  };
}

function StatusButtonGroup({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      <div>{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-coke focus:ring-offset-2 ${
                selected ? "border-coke bg-coke text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

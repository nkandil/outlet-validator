import { useEffect, useMemo, useState } from "react";
import { useOptionalAuth } from "../auth";
import { Button, Field, Sheet, Textarea } from "../components/ui";
import { haversineKm } from "../lib/geo";
import { asString } from "../lib/utils";
import { useOutletStore } from "../store";
import type { FieldValidation, Outlet, OutletValidation } from "../types";

const outletStatuses = ["Valid", "Needs Update", "Invalid", "Duplicate", "Could Not Verify"] as const;
const fieldStatuses = ["Valid", "Invalid", "Not Sure"] as const;

function emptyFieldValidation(): FieldValidation {
  return { status: "", correctedValue: "", comment: "" };
}

function normalizeOutletStatus(status: string): OutletValidation["status"] {
  return (status === "Invalid Lead" ? "Invalid" : status) as OutletValidation["status"];
}

function makeDraft(existing: OutletValidation | undefined, reviewerName: string): OutletValidation {
  return existing
    ? { ...existing, status: normalizeOutletStatus(existing.status) }
    : {
        status: "",
        generalComments: "",
        validatedBy: reviewerName,
        validatedAt: "",
        fields: {}
      };
}

export function Step8OutletReview({
  outlet,
  onSync,
  nextOutletKey = null
}: {
  outlet: Outlet;
  onSync: (outletKey: string, validation: OutletValidation) => Promise<void>;
  nextOutletKey?: string | null;
}) {
  const state = useOutletStore();
  const auth = useOptionalAuth();
  const reviewerName = auth?.user?.name ?? state.reviewerName;
  const reviewerId = auth?.user?.id;
  const existing = state.validations[outlet.outletKey];
  const [draft, setDraft] = useState<OutletValidation>(() => makeDraft(existing, reviewerName));
  const displayName = useMemo(() => (state.confirmedMapping.displayField ? asString(outlet.originalData[state.confirmedMapping.displayField]) : ""), [outlet, state.confirmedMapping.displayField]);

  useEffect(() => {
    setDraft(makeDraft(existing, reviewerName));
  }, [existing, outlet.outletKey, reviewerName]);

  function updateField(field: string, patch: Partial<FieldValidation>) {
    setDraft((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]: { ...(current.fields[field] ?? emptyFieldValidation()), ...patch }
      }
    }));
  }

  function save(advance = false) {
    const gps = captureGpsEvidence(outlet, state.userLocation);
    const validation = {
      ...draft,
      ...gps,
      validatedBy: reviewerName,
      reviewerId,
      validatedAt: new Date().toISOString()
    };
    state.saveValidationLocal(outlet.outletKey, validation);
    state.selectOutlet(advance && nextOutletKey ? nextOutletKey : null);
    void onSync(outlet.outletKey, validation);
  }

  return (
    <Sheet open className="grid overflow-hidden p-0">
      <div className="sticky top-0 z-10 border-b bg-white/95 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-foreground">{displayName || outlet.id}</h2>
            <p className="text-sm text-muted-foreground">
              ID {outlet.id} - {outlet.latitude}, {outlet.longitude}
              {outlet.distanceKm !== null ? ` - ${outlet.distanceKm.toFixed(2)} km` : ""}
            </p>
          </div>
          <Button variant="ghost" onClick={() => state.selectOutlet(null)}>
            Close
          </Button>
        </div>
      </div>

      <div className="max-h-[calc(92dvh-9rem)] overflow-y-auto p-4 pb-28">
        <div className="grid gap-5">
          <StatusButtonGroup label="Outlet status" options={outletStatuses} value={draft.status} onChange={(status) => setDraft({ ...draft, status: status as OutletValidation["status"] })} />

          <div className="grid gap-2">
            <h3 className="font-semibold text-foreground">Visible fields</h3>
            {state.visibleFields.map((field) => (
              <div key={field} className="rounded-md border bg-background p-3 text-sm">
                <div className="font-medium text-muted-foreground">{field}</div>
                <div className="mt-1 break-words text-foreground">{asString(outlet.originalData[field]) || "-"}</div>
              </div>
            ))}
          </div>

          {state.fieldsToVerify.length ? (
            <div className="grid gap-3">
              <h3 className="font-semibold text-foreground">Field validation</h3>
              {state.fieldsToVerify.map((field) => {
                const fieldDraft = draft.fields[field] ?? emptyFieldValidation();
                const needsDetail = fieldDraft.status === "Invalid" || fieldDraft.status === "Not Sure";
                return (
                  <div key={field} className="grid gap-3 rounded-md border bg-background p-3">
                    <div>
                      <div className="font-medium text-muted-foreground">{field}</div>
                      <div className="text-sm text-foreground">{asString(outlet.originalData[field]) || "-"}</div>
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
        </div>
      </div>

      <div className="sticky bottom-0 z-10 grid gap-2 border-t bg-white/95 p-4 backdrop-blur sm:grid-cols-2">
        {nextOutletKey ? (
          <Button disabled={!draft.status} onClick={() => save(true)}>
            Save & Next
          </Button>
        ) : null}
        <Button variant={nextOutletKey ? "outline" : "primary"} disabled={!draft.status} onClick={() => save(false)}>
          Save Review
        </Button>
      </div>
    </Sheet>
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
    <div className="grid gap-1.5 text-sm font-medium text-foreground">
      <div>{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={`min-h-10 rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-accent"
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

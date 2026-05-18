import { useState } from "react";
import { useAuth } from "../auth";
import { Alert, Button, Panel } from "../components/ui";
import { sessionsApi } from "../lib/api";
import { useOutletStore } from "../store";

export function Step6ReviewerName() {
  const state = useOutletStore();
  const { user } = useAuth();
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  async function continueToFieldMode() {
    if (!user || saving) return;
    setSaving(true);
    state.setReviewerName(user.name);
    state.setSyncState("syncing");
    try {
      const config = { ...state.getSessionConfig(), reviewerName: user.name };
      if (state.sessionId) {
        await sessionsApi.update(state.sessionId, { config, radiusKm: state.radiusKm });
      } else {
        const created = await sessionsApi.create({
          name: state.sessionName || state.fileName || "Outlet validation session",
          fileName: state.fileName || "outlets.xlsx",
          radiusKm: state.radiusKm,
          config,
          outlets: state.outlets,
          validations: state.validations
        });
        state.setSessionMeta(created.id, created.name);
      }
      state.setSyncState("synced");
    } catch (err) {
      state.setSyncState("failed", err instanceof Error ? err.message : "Backend unavailable");
      setWarning("Session was saved locally. Backend sync will retry later.");
    } finally {
      setSaving(false);
      state.setStep(7);
    }
  }

  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Reviewer</h2>
          <p className="mt-1 text-sm text-slate-500">{user ? `${user.name} (${user.email})` : "Signed-in user"}</p>
        </div>
        {warning ? <Alert tone="warning">{warning}</Alert> : null}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => state.setStep(5)}>
            Back
          </Button>
          <Button disabled={saving} onClick={continueToFieldMode}>{saving ? "Saving..." : "Start Validation"}</Button>
        </div>
      </Panel>
    </div>
  );
}

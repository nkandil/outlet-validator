import { Edit3, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { canAdminister, canManageSessions, useOptionalAuth } from "../auth";
import type { SessionSummary } from "../types";
import { sessionsApi, usersApi } from "../lib/api";
import { buildLocalSessionSummary, localSessionId, type LocalSessionSummary } from "../lib/local-session";
import { formatDate } from "../lib/utils";
import { useOutletStore } from "../store";
import { Alert, Badge, Button, Dropdown, DropdownItem, Input, PageHeader, PageShell, Panel } from "../components/ui";

type SessionListItem = SessionSummary | LocalSessionSummary;

export function Step0SessionPicker() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [reviewers, setReviewers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [assignedReviewerIds, setAssignedReviewerIds] = useState<string[]>([]);
  const auth = useOptionalAuth();
  const user = auth?.user ?? { id: "test-user", name: "Test User", email: "test@example.com", role: "admin" as const };
  const logout = auth?.logout ?? (() => undefined);
  const canManage = canManageSessions(user);
  const reset = useOutletStore((state) => state.reset);
  const setStep = useOutletStore((state) => state.setStep);
  const hydrateSession = useOutletStore((state) => state.hydrateSession);
  const sessionId = useOutletStore((state) => state.sessionId);
  const sessionName = useOutletStore((state) => state.sessionName);
  const fileName = useOutletStore((state) => state.fileName);
  const radiusKm = useOutletStore((state) => state.radiusKm);
  const outlets = useOutletStore((state) => state.outlets);
  const validations = useOutletStore((state) => state.validations);
  const pendingSync = useOutletStore((state) => state.pendingSync);
  const localSummary = useMemo(
    () =>
      buildLocalSessionSummary({
        sessionId,
        sessionName,
        fileName,
        radiusKm,
        outlets,
        validations,
        pendingSync
      }),
    [fileName, outlets, pendingSync, radiusKm, sessionId, sessionName, validations]
  );
  const displaySessions: SessionListItem[] = localSummary ? [localSummary, ...sessions.filter((session) => session.id !== localSummary.id)] : sessions;

  async function loadSessions() {
    setLoading(true);
    setError("");
    try {
      setSessions(await sessionsApi.list());
    } catch (err) {
      setError("Backend sessions are unavailable. Local browser sessions remain accessible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function openSession(id: string) {
    setError("");
    if (id === localSessionId) {
      setStep(7);
      return;
    }

    try {
      hydrateSession(await sessionsApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open session");
    }
  }

  async function saveRename(id: string) {
    if (id === localSessionId) return;
    if (!renameValue.trim()) return;
    await sessionsApi.update(id, { name: renameValue.trim() });
    setRenaming(null);
    await loadSessions();
  }

  async function deleteSession(session: SessionListItem) {
    if (!window.confirm(`Delete "${session.name}"? This cannot be undone.`)) return;
    if ("isLocal" in session) {
      reset();
      return;
    }

    await sessionsApi.delete(session.id);
    setSessions((items) => items.filter((item) => item.id !== session.id));
  }

  function startNew() {
    reset();
    setStep(1);
  }

  async function startAssignment(id: string) {
    setAssigning(id);
    setError("");
    try {
      const [reviewerRows, assignment] = await Promise.all([usersApi.list("reviewer"), sessionsApi.getAssignments(id)]);
      setReviewers(reviewerRows);
      setAssignedReviewerIds(assignment.userIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignments");
    }
  }

  async function saveAssignment() {
    if (!assigning) return;
    await sessionsApi.setAssignments(assigning, { userIds: assignedReviewerIds });
    setAssigning(null);
  }

  function toggleReviewer(id: string) {
    setAssignedReviewerIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader
          title="Outlet Validator"
          description="Market Visit Validation"
          actions={
            <>
            {canManage ? (
              <a className="hidden min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent sm:inline-flex" href="/dashboard">
                Dashboard
              </a>
            ) : null}
            {canAdminister(user) ? (
              <a className="hidden min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent sm:inline-flex" href="/admin">
                Admin
              </a>
            ) : null}
            <Button className="hidden sm:inline-flex" variant="secondary" onClick={loadSessions}>
              <RefreshCw size={18} />
              Refresh
            </Button>
            {canManage ? <Button onClick={startNew}>Start New Session</Button> : null}
            <Button className="hidden sm:inline-flex" variant="ghost" onClick={logout}>
              Logout
            </Button>
            <Dropdown label="Menu" className="sm:hidden">
              {canManage ? <DropdownItem><a href="/dashboard">Dashboard</a></DropdownItem> : null}
              {canAdminister(user) ? <DropdownItem><a href="/admin">Admin</a></DropdownItem> : null}
              <DropdownItem onClick={loadSessions}>Refresh</DropdownItem>
              <DropdownItem onClick={logout}>Logout</DropdownItem>
            </Dropdown>
            </>
          }
        />

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {loading ? <Panel>Loading saved sessions...</Panel> : null}
        {!loading && displaySessions.length === 0 ? (
          <Panel className="grid gap-4 py-10 text-center">
            <div>
              <h2 className="text-xl font-bold text-slate-950">No saved sessions</h2>
              <p className="mt-1 text-sm text-slate-500">Upload an outlet file to start validating field data.</p>
            </div>
            <div>
            {canManage ? <Button onClick={startNew}>Start New Session</Button> : null}
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-3">
          {displaySessions.map((session) => (
            <Panel key={session.id} className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {renaming === session.id && !("isLocal" in session) ? (
            <div className="flex gap-2">
                      <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                      <Button onClick={() => saveRename(session.id)}>Save</Button>
                    </div>
                  ) : (
                    <button className="text-left text-lg font-bold text-slate-950 hover:text-coke" onClick={() => openSession(session.id)}>
                      {session.name}
                      {"isLocal" in session ? <span className="ml-2 text-xs font-semibold text-amber-700">(local)</span> : null}
                    </button>
                  )}
                  <p className="text-sm text-slate-500">{session.fileName}</p>
                </div>
                <div className="flex gap-2">
                  {"isLocal" in session || !canManage ? null : (
                    <Button
                      variant="secondary"
                      title="Rename"
                      onClick={() => {
                        setRenaming(session.id);
                        setRenameValue(session.name);
                      }}
                    >
                      <Edit3 size={16} />
                    </Button>
                  )}
                  {"isLocal" in session || user?.role === "admin" ? (
                  <Button variant="secondary" title="Delete" onClick={() => deleteSession(session)}>
                    <Trash2 size={16} />
                  </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{session.outletCount} outlets</Badge>
                <Badge tone={session.reviewedCount ? "success" : "neutral"}>{session.reviewedCount} reviewed</Badge>
                <Badge>{session.radiusKm ?? 5} km radius</Badge>
                <span className="text-slate-500">Updated {formatDate(session.updatedAt)}</span>
              </div>
              {"isLocal" in session || !canManage ? null : (
                <div>
                  <Button variant="secondary" onClick={() => startAssignment(session.id)}>
                    Assign Users
                  </Button>
                </div>
              )}
              {assigning === session.id ? (
                <div className="grid gap-3 rounded-md border bg-muted/50 p-3">
                  <div className="text-sm font-semibold text-slate-900">Reviewers</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {reviewers.map((reviewer) => (
                      <label key={reviewer.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={assignedReviewerIds.includes(reviewer.id)} onChange={() => toggleReviewer(reviewer.id)} />
                        <span>{reviewer.name} ({reviewer.email})</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveAssignment}>Save Assignments</Button>
                    <Button variant="ghost" onClick={() => setAssigning(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

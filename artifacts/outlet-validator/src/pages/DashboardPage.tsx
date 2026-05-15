import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { canAdminister, canManageSessions, useAuth } from "../auth";
import { Alert, Badge, Button, PageHeader, PageShell, Panel, Select } from "../components/ui";
import { dashboardApi, sessionsApi } from "../lib/api";
import { getPendingValidationSyncItems } from "../lib/sync-queue";
import type { DashboardMetrics, SessionSummary } from "../types";

const emptyMetrics: DashboardMetrics = {
  totalSessions: 0,
  activeSessions: 0,
  totalOutlets: 0,
  reviewedOutlets: 0,
  pendingOutlets: 0,
  validCount: 0,
  invalidCount: 0,
  needsUpdateCount: 0,
  duplicateCount: 0,
  gpsMissingCount: 0
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [error, setError] = useState("");

  if (!canManageSessions(user)) return <Navigate to="/" replace />;

  async function load() {
    setError("");
    try {
      const [nextSessions, nextMetrics, pending] = await Promise.all([sessionsApi.list(), dashboardApi.get({ sessionId: sessionId || undefined }), getPendingValidationSyncItems()]);
      setSessions(nextSessions);
      setMetrics(nextMetrics);
      setPendingSyncCount(pending.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard unavailable");
    }
  }

  useEffect(() => {
    void load();
    // Reload when the selected session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <PageShell>
      <div className="mx-auto grid max-w-6xl gap-4">
        <PageHeader
          title="Dashboard"
          description={user?.name}
          actions={
            <>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent" to="/">
              Sessions
            </Link>
            {canAdminister(user) ? (
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent" to="/admin">
                Admin
              </Link>
            ) : null}
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={18} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
            </>
          }
        />
        <Panel>
          <div className="max-w-sm">
            <Select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          </div>
        </Panel>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Kpi label="Sessions" value={metrics.totalSessions} detail={`${metrics.activeSessions} active`} />
            <Kpi label="Outlets" value={metrics.totalOutlets} detail={`${metrics.pendingOutlets} pending`} />
            <Kpi label="Reviewed" value={metrics.reviewedOutlets} detail={`${reviewPercent(metrics)}% complete`} tone="success" />
            <Kpi label="Pending sync" value={pendingSyncCount} detail={pendingSyncCount ? "Needs retry" : "Clear"} tone={pendingSyncCount ? "warning" : "success"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[360px_1fr_280px]">
            <ProgressDonut metrics={metrics} />
            <StatusBars metrics={metrics} />
            <SyncPanel pendingSyncCount={pendingSyncCount} selectedSession={sessions.find((session) => session.id === sessionId)} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Kpi({ label, value, detail, tone = "neutral" }: { label: string; value: number; detail: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <Panel className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <Badge tone={tone}>{detail}</Badge>
      </div>
      <div className="text-3xl font-extrabold text-slate-950">{value}</div>
    </Panel>
  );
}

function ProgressDonut({ metrics }: { metrics: DashboardMetrics }) {
  const percent = reviewPercent(metrics);
  const circumference = 2 * Math.PI * 42;
  const dash = (percent / 100) * circumference;
  return (
    <Panel className="grid content-start gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Review progress</h2>
        <p className="text-sm text-slate-500">{metrics.reviewedOutlets} reviewed of {metrics.totalOutlets} outlets</p>
      </div>
      <div className="grid place-items-center">
        <svg aria-label="Reviewed progress chart" className="h-44 w-44" viewBox="0 0 120 120" role="img">
          <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" strokeWidth="14" />
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke="#16a34a"
            strokeLinecap="round"
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="57" textAnchor="middle" className="fill-slate-950 text-2xl font-extrabold">
            {percent}%
          </text>
          <text x="60" y="76" textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold uppercase">
            complete
          </text>
        </svg>
      </div>
    </Panel>
  );
}

function StatusBars({ metrics }: { metrics: DashboardMetrics }) {
  const items = [
    { label: "Valid", value: metrics.validCount, color: "bg-green-500" },
    { label: "Invalid", value: metrics.invalidCount, color: "bg-red-500" },
    { label: "Needs update", value: metrics.needsUpdateCount, color: "bg-amber-500" },
    { label: "Duplicate", value: metrics.duplicateCount, color: "bg-slate-500" },
    { label: "GPS missing", value: metrics.gpsMissingCount, color: "bg-cyan-600" }
  ];
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <Panel className="grid content-start gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Status distribution</h2>
        <p className="text-sm text-slate-500">Validation outcomes for the selected scope.</p>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-700">{item.label}</span>
              <span className="font-bold text-slate-950">{item.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max((item.value / max) * 100, item.value ? 6 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SyncPanel({ pendingSyncCount, selectedSession }: { pendingSyncCount: number; selectedSession?: SessionSummary }) {
  return (
    <Panel className="grid content-start gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Sync status</h2>
        <p className="text-sm text-slate-500">{selectedSession ? selectedSession.name : "All sessions"}</p>
      </div>
      <div className="rounded-md border bg-muted/50 p-4">
        <div className="text-3xl font-extrabold text-slate-950">{pendingSyncCount}</div>
        <div className="mt-1 text-sm font-semibold text-slate-600">pending sync items</div>
      </div>
      <Badge tone={pendingSyncCount ? "warning" : "success"}>{pendingSyncCount ? "Action needed" : "Up to date"}</Badge>
    </Panel>
  );
}

function reviewPercent(metrics: DashboardMetrics) {
  if (!metrics.totalOutlets) return 0;
  return Math.round((metrics.reviewedOutlets / metrics.totalOutlets) * 100);
}

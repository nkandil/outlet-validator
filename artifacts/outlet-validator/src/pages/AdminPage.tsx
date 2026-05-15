import { Save, Search, Settings, Trash2, Users } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { canAdminister, useAuth } from "../auth";
import { ShapePicker } from "../components/ShapePicker";
import { Alert, Badge, Button, Field, Input, PageHeader, PageShell, Panel, Select, TabButton as UiTabButton, Tabs, Textarea } from "../components/ui";
import { groupsApi, sessionsApi, usersApi } from "../lib/api";
import { pinShapes } from "../lib/pins";
import type { AuthUser, Outlet, SessionConfig, SessionDetail, SessionSummary, UserGroup, UserRole } from "../types";

type Tab = "users" | "groups" | "sessions";
type Assignment = { userIds: string[]; groupIds: string[] };

const roles: UserRole[] = ["admin", "coordinator", "reviewer"];
const defaultColors = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0f766e"];

export function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!canAdminister(user)) return <Navigate to="/" replace />;

  async function load() {
    setError("");
    try {
      const [nextUsers, nextGroups, nextSessions] = await Promise.all([usersApi.list(), groupsApi.list(), sessionsApi.list()]);
      setUsers(nextUsers);
      setGroups(nextGroups);
      setSessions(nextSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin data unavailable");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <PageShell>
      <div className="mx-auto grid max-w-7xl gap-4">
        <PageHeader
          title="Admin"
          description={user?.name}
          actions={
            <>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent" to="/">
              Sessions
            </Link>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:bg-accent" to="/dashboard">
              Dashboard
            </Link>
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
            </>
          }
        />

        <Tabs className="w-full overflow-x-auto sm:w-fit">
          <UiTabButton active={tab === "users"} onClick={() => setTab("users")}>
            Users
          </UiTabButton>
          <UiTabButton active={tab === "groups"} onClick={() => setTab("groups")}>
            Groups
          </UiTabButton>
          <UiTabButton active={tab === "sessions"} onClick={() => setTab("sessions")}>
            Sessions
          </UiTabButton>
        </Tabs>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        {tab === "users" ? <UsersTab users={users} currentUserId={user?.id ?? ""} onChanged={async (text) => { notify(text); await load(); }} /> : null}
        {tab === "groups" ? <GroupsTab users={users} groups={groups} onChanged={async () => { notify("Groups updated"); await load(); }} /> : null}
        {tab === "sessions" ? <SessionsTab users={users} groups={groups} sessions={sessions} onChanged={async () => { notify("Session updated"); await load(); }} /> : null}
      </div>
    </PageShell>
  );
}

function UsersTab({ users, currentUserId, onChanged }: { users: AuthUser[]; currentUserId: string; onChanged: (text: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("reviewer");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const filtered = users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()));

  async function createUser() {
    setSaving(true);
    try {
      await usersApi.create({ name, email, role, password });
      setName("");
      setEmail("");
      setRole("reviewer");
      setPassword("");
      await onChanged("User created");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(id: string, nextRole: UserRole) {
    setRoleSavingId(id);
    try {
      await usersApi.updateRole(id, nextRole);
      await onChanged("User role updated");
    } finally {
      setRoleSavingId("");
    }
  }

  async function deleteUser(user: AuthUser) {
    if (!window.confirm("Deactivate this user? Their past reviews stay in reports.")) return;
    setDeletingId(user.id);
    try {
      await usersApi.delete(user.id);
      await onChanged("User deactivated");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel className="grid content-start gap-3">
        <h2 className="text-lg font-bold text-slate-950">Create user</h2>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Temporary password">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button disabled={saving || !name.trim() || !email.trim() || password.length < 8} onClick={createUser}>
          <Users size={18} />
          Create user
        </Button>
      </Panel>

      <Panel className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Users</h2>
          <label className="relative min-w-64">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <Input className="pl-10" aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 font-semibold text-slate-900">{item.name}</td>
                  <td>{item.email}</td>
                  <td>
                    <Select
                      aria-label={`Role for ${item.name}`}
                      className="h-10 min-h-0 w-40 bg-slate-50 py-1 text-sm"
                      value={item.role}
                      disabled={roleSavingId === item.id}
                      onChange={(event) => void updateRole(item.id, event.target.value as UserRole)}
                    >
                      {roles.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      className="min-h-10 w-10 px-0 text-slate-500 hover:text-red-700"
                      aria-label={`Delete ${item.name}`}
                      title={`Delete ${item.name}`}
                      disabled={item.id === currentUserId || deletingId === item.id}
                      onClick={() => void deleteUser(item)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function GroupsTab({ users, groups, onChanged }: { users: AuthUser[]; groups: UserGroup[]; onChanged: () => Promise<void> }) {
  const reviewers = users.filter((user) => user.role === "reviewer");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function createGroup() {
    await groupsApi.create({ name, description });
    setName("");
    setDescription("");
    await onChanged();
  }

  async function editGroup(id: string) {
    const group = groups.find((item) => item.id === id);
    setEditingId(id);
    setEditName(group?.name ?? "");
    setEditDescription(group?.description ?? "");
    const members = await groupsApi.getMembers(id);
    setMemberIds(members.userIds);
  }

  async function saveGroupDetails() {
    await groupsApi.update(editingId, { name: editName, description: editDescription });
    await onChanged();
  }

  async function saveMembers() {
    await groupsApi.setMembers(editingId, memberIds);
    setEditingId("");
    await onChanged();
  }

  async function deleteGroup(group: UserGroup) {
    if (!window.confirm(`Delete "${group.name}"? This removes group assignments but does not delete users.`)) return;
    await groupsApi.delete(group.id);
    if (editingId === group.id) setEditingId("");
    await onChanged();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel className="grid content-start gap-3">
        <h2 className="text-lg font-bold text-slate-950">Create group</h2>
        <Field label="Group name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Button disabled={!name.trim()} onClick={createGroup}>
          Create group
        </Button>
      </Panel>

      <Panel className="grid content-start gap-3">
        <h2 className="text-lg font-bold text-slate-950">Groups</h2>
        <div className="grid gap-2">
          {groups.map((group) => (
            <div key={group.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-slate-950">{group.name}</div>
                  <div className="text-sm text-slate-500">{group.description || "No description"}</div>
                  <div className="mt-2">
                    <Badge>{editingId === group.id ? memberIds.length : 0} {editingId === group.id && memberIds.length === 1 ? "member" : "members"}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => editGroup(group.id)}>
                    Edit {group.name}
                  </Button>
                  <Button variant="danger" onClick={() => deleteGroup(group)}>
                    Delete {group.name}
                  </Button>
                </div>
              </div>
              {editingId === group.id ? (
                <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <section className="grid gap-3" aria-label="Group details">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Group details</h3>
                      <p className="text-xs text-slate-500">Name and describe the team admins assign to sessions.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(12rem,18rem)_1fr]">
                      <Field label="Edit group name">
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                      </Field>
                      <Field label="Edit description">
                        <Textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                      </Field>
                    </div>
                    <div>
                      <Button disabled={!editName.trim()} onClick={saveGroupDetails}>
                        Save group details
                      </Button>
                    </div>
                  </section>
                  <section className="grid gap-3 border-t border-slate-200 pt-4" aria-label="Members">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Members</h3>
                      <p className="text-xs text-slate-500">Reviewers in this group inherit assigned sessions.</p>
                    </div>
                    <fieldset role="group" aria-label="Group members" className="grid gap-2 sm:grid-cols-2">
                      {reviewers.map((reviewer) => (
                        <label key={reviewer.id} className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
                          <input className="mt-1" type="checkbox" checked={memberIds.includes(reviewer.id)} onChange={() => setMemberIds(toggle(memberIds, reviewer.id))} />
                          <span>
                            <span className="block font-semibold text-slate-900">{reviewer.name}</span>
                            <span className="text-slate-500">{reviewer.email}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="flex gap-2">
                      <Button onClick={saveMembers}>Save members</Button>
                      <Button variant="ghost" onClick={() => setEditingId("")}>
                        Cancel
                      </Button>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SessionsTab({ users, groups, sessions, onChanged }: { users: AuthUser[]; groups: UserGroup[]; sessions: SessionSummary[]; onChanged: () => Promise<void> }) {
  const reviewers = users.filter((user) => user.role === "reviewer");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [assignment, setAssignment] = useState<Assignment>({ userIds: [], groupIds: [] });

  async function manage(id: string) {
    setSelectedId(id);
    const [nextDetail, nextAssignment] = await Promise.all([sessionsApi.get(id), sessionsApi.getAssignments(id)]);
    setDetail(nextDetail);
    setAssignment({ userIds: nextAssignment.userIds, groupIds: nextAssignment.groupIds ?? [] });
  }

  async function saveAssignments() {
    if (!selectedId) return;
    await sessionsApi.setAssignments(selectedId, assignment);
    await onChanged();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Panel className="grid content-start gap-2">
        <h2 className="text-lg font-bold text-slate-950">Sessions</h2>
        {sessions.map((session) => (
          <button key={session.id} className="rounded-md border border-slate-200 p-3 text-left hover:border-coke" onClick={() => manage(session.id)}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-950">{session.name}</span>
              <span className="text-xs text-slate-500">{session.radiusKm} km</span>
            </div>
            <span className="text-sm text-slate-500">{session.fileName}</span>
            <span className="sr-only">Manage {session.name}</span>
          </button>
        ))}
      </Panel>

      {detail ? (
        <div className="grid gap-4">
          <Panel className="grid gap-3">
            <h2 className="text-lg font-bold text-slate-950">Assignments</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-slate-700">Reviewers</legend>
                {reviewers.map((reviewer) => (
                  <label key={reviewer.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assignment.userIds.includes(reviewer.id)} onChange={() => setAssignment({ ...assignment, userIds: toggle(assignment.userIds, reviewer.id) })} />
                    <span>
                      {reviewer.name} ({reviewer.email})
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-slate-700">Groups</legend>
                {groups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assignment.groupIds.includes(group.id)} onChange={() => setAssignment({ ...assignment, groupIds: toggle(assignment.groupIds, group.id) })} />
                    <span>{group.name}</span>
                  </label>
                ))}
              </fieldset>
            </div>
            <div>
              <Button onClick={saveAssignments}>
                <Save size={18} />
                Save assignments
              </Button>
            </div>
          </Panel>
          <ConfigEditor detail={detail} onSaved={onChanged} />
        </div>
      ) : (
        <Panel className="grid min-h-48 place-items-center text-sm text-slate-500">Select a session to manage assignments and configuration.</Panel>
      )}
    </div>
  );
}

function ConfigEditor({ detail, onSaved }: { detail: SessionDetail; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(detail.name);
  const [radiusKm, setRadiusKm] = useState(String(detail.radiusKm));
  const [config, setConfig] = useState<SessionConfig>(detail.config);
  const [preview, setPreview] = useState<string[]>([]);
  const headers = config.rawHeaders;
  const mapping = config.confirmedMapping;
  const requiredMissing = !mapping.id || !mapping.lat || !mapping.lng;
  const colorValues = distinctValues(detail.outlets, mapping.colorByField);
  const shapeValues = distinctValues(detail.outlets, mapping.shapeByField);

  useEffect(() => {
    setName(detail.name);
    setRadiusKm(String(detail.radiusKm));
    setConfig(detail.config);
    setPreview([]);
  }, [detail]);

  function updateMapping(patch: Partial<SessionConfig["confirmedMapping"]>) {
    setConfig((current) => ({ ...current, confirmedMapping: { ...current.confirmedMapping, ...patch } }));
  }

  function buildPreview() {
    const changes = [];
    if (name !== detail.name) changes.push(`name changes from ${detail.name} to ${name}`);
    if (Number(radiusKm) !== detail.radiusKm) changes.push(`radius changes from ${detail.radiusKm} km to ${radiusKm} km`);
    if (mapping.displayField !== detail.config.confirmedMapping.displayField) changes.push(`display field changes from ${detail.config.confirmedMapping.displayField || "none"} to ${mapping.displayField || "none"}`);
    if (mapping.id !== detail.config.confirmedMapping.id) changes.push(`ID field changes from ${detail.config.confirmedMapping.id} to ${mapping.id}`);
    if (mapping.lat !== detail.config.confirmedMapping.lat || mapping.lng !== detail.config.confirmedMapping.lng) changes.push("map coordinates will be recalculated");
    setPreview(changes.length ? changes : ["No configuration changes detected"]);
  }

  async function saveConfig() {
    const outlets = rebuildOutlets(detail.outlets, config);
    await sessionsApi.update(detail.id, { name, radiusKm: Number(radiusKm), config, outlets });
    await onSaved();
  }

  return (
    <Panel className="grid gap-4">
      <div className="flex items-center gap-2">
        <Settings size={18} className="text-coke" />
        <h2 className="text-lg font-bold text-slate-950">Session configuration</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Session name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Nearby radius">
          <Input type="number" min="0.1" step="0.1" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} />
        </Field>
        <Field label="ID field">
          <FieldSelect value={mapping.id} headers={headers} onChange={(value) => updateMapping({ id: value })} />
        </Field>
        <Field label="Display field">
          <FieldSelect value={mapping.displayField} headers={headers} onChange={(value) => updateMapping({ displayField: value })} allowEmpty />
        </Field>
        <Field label="Latitude field">
          <FieldSelect value={mapping.lat} headers={headers} onChange={(value) => updateMapping({ lat: value })} />
        </Field>
        <Field label="Longitude field">
          <FieldSelect value={mapping.lng} headers={headers} onChange={(value) => updateMapping({ lng: value })} />
        </Field>
        <Field label="Color by field">
          <FieldSelect value={mapping.colorByField} headers={headers} onChange={(value) => updateMapping({ colorByField: value, colorByValues: seedColorValues(detail.outlets, value) })} allowEmpty />
        </Field>
        <Field label="Shape by field">
          <FieldSelect value={mapping.shapeByField} headers={headers} onChange={(value) => updateMapping({ shapeByField: value, shapeByValues: seedShapeValues(detail.outlets, value) })} allowEmpty />
        </Field>
      </div>

      <FieldPicker title="Visible fields" headers={headers} selected={config.visibleFields} onChange={(visibleFields) => setConfig({ ...config, visibleFields })} />
      <FieldPicker title="Fields to verify" headers={headers} selected={config.fieldsToVerify} onChange={(fieldsToVerify) => setConfig({ ...config, fieldsToVerify })} />

      {colorValues.length ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Color values</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {colorValues.map((value, index) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="color" value={mapping.colorByValues[value] ?? defaultColors[index % defaultColors.length]} onChange={(event) => updateMapping({ colorByValues: { ...mapping.colorByValues, [value]: event.target.value } })} />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {shapeValues.length ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Shape values</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shapeValues.map((value) => (
              <div key={value} className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm">
                <div className="font-semibold text-slate-700">{value}</div>
                <ShapePicker
                  label={`${value} shape`}
                  value={mapping.shapeByValues[value] ?? "circle"}
                  onChange={(shape) => updateMapping({ shapeByValues: { ...mapping.shapeByValues, [value]: shape } })}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {requiredMissing ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">ID, latitude, and longitude fields are required.</div> : null}
      {preview.length ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {preview.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={buildPreview}>
          Preview changes
        </Button>
        <Button disabled={requiredMissing || !name.trim() || Number(radiusKm) <= 0} onClick={saveConfig}>
          Save config
        </Button>
      </div>
    </Panel>
  );
}

function FieldSelect({ headers, value, onChange, allowEmpty = false }: { headers: string[]; value: string; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {allowEmpty ? <option value="">None</option> : null}
      {headers.map((header) => (
        <option key={header} value={header}>
          {header}
        </option>
      ))}
    </Select>
  );
}

function FieldPicker({ title, headers, selected, onChange }: { title: string; headers: string[]; selected: string[]; onChange: (fields: string[]) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-slate-700">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {headers.map((header) => (
          <label key={header} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(header)} onChange={() => onChange(toggle(selected, header))} />
            <span>{header}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function distinctValues(outlets: Outlet[], field: string) {
  if (!field) return [];
  return [...new Set(outlets.map((outlet) => String(outlet.originalData[field] ?? "")).filter(Boolean))].slice(0, 50);
}

function seedColorValues(outlets: Outlet[], field: string) {
  return Object.fromEntries(distinctValues(outlets, field).map((value, index) => [value, defaultColors[index % defaultColors.length]]));
}

function seedShapeValues(outlets: Outlet[], field: string) {
  return Object.fromEntries(distinctValues(outlets, field).map((value, index) => [value, pinShapes[index % pinShapes.length]]));
}

function rebuildOutlets(outlets: Outlet[], config: SessionConfig): Outlet[] {
  const mapping = config.confirmedMapping;
  return outlets.map((outlet) => {
    const id = String(outlet.originalData[mapping.id] ?? outlet.id);
    const latitude = Number(outlet.originalData[mapping.lat] ?? outlet.latitude);
    const longitude = Number(outlet.originalData[mapping.lng] ?? outlet.longitude);
    return {
      ...outlet,
      id,
      outletKey: `${id}__row_${outlet.rowIndex}`,
      latitude: Number.isFinite(latitude) ? latitude : outlet.latitude,
      longitude: Number.isFinite(longitude) ? longitude : outlet.longitude
    };
  });
}

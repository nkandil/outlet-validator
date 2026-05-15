import {
  countReviewed,
  getDb,
  outletValidations,
  sessionGroupAssignments,
  sessionAssignments,
  sessionOutlets,
  users,
  validationSessions,
  type AuthUser,
  type CreateSessionBody,
  type DashboardMetrics,
  type Outlet,
  type OutletValidation,
  type OutletValidationRow,
  type SessionDetail,
  type SessionOutletRow,
  type SessionSummary,
  type UpdateSessionBody,
  type ValidationSessionRow
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { HttpError } from "../http-error";
import type { GroupRepository } from "../groups/repository";

export interface AssignmentsResponse {
  userIds: string[];
  groupIds: string[];
}

export interface SessionRepository {
  list(user: AuthUser): Promise<SessionSummary[]>;
  create(body: CreateSessionBody, user: AuthUser): Promise<SessionSummary>;
  get(id: string, user: AuthUser): Promise<SessionDetail | null>;
  update(id: string, body: UpdateSessionBody, user: AuthUser): Promise<SessionSummary | null>;
  delete(id: string, user: AuthUser): Promise<boolean>;
  assign(id: string, assignment: AssignmentsResponse, user: AuthUser): Promise<AssignmentsResponse>;
  getAssignments(id: string, user: AuthUser): Promise<AssignmentsResponse>;
  upsertValidation(sessionId: string, outletKey: string, body: OutletValidation, user: AuthUser): Promise<OutletValidation>;
  dashboard(user: AuthUser, filters?: { sessionId?: string; reviewerId?: string }): Promise<DashboardMetrics>;
}

function canManageSessions(user: AuthUser) {
  return user.role === "admin" || user.role === "coordinator";
}

function assertCanManageSessions(user: AuthUser) {
  if (!canManageSessions(user)) throw new HttpError(403, "Forbidden");
}

function assertCanDelete(user: AuthUser) {
  if (user.role !== "admin") throw new HttpError(403, "Forbidden");
}

function toSummary(row: ValidationSessionRow): SessionSummary {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    radiusKm: row.radiusKm ?? 5,
    outletCount: row.outletCount,
    reviewedCount: row.reviewedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function outletName(outlet: Outlet, row: ValidationSessionRow) {
  const displayField = row.config.confirmedMapping.displayField;
  const value = displayField ? outlet.originalData[displayField] : "";
  return String(value ?? "");
}

function toOutlet(row: SessionOutletRow): Outlet {
  return {
    outletKey: row.outletKey,
    rowIndex: row.rowIndex,
    id: row.outletCode,
    latitude: row.latitude,
    longitude: row.longitude,
    originalData: row.rawData,
    distanceKm: null
  };
}

function toValidation(row: OutletValidationRow, reviewer: { id: string; name: string } | undefined): OutletValidation {
  return {
    status: row.status,
    generalComments: row.notes,
    correctedValue: row.correctedValue,
    validatedBy: reviewer?.name ?? "",
    reviewerId: row.reviewerId,
    validatedAt: row.updatedAt.toISOString(),
    fields: row.fields,
    gpsLatitude: row.gpsLatitude,
    gpsLongitude: row.gpsLongitude,
    gpsAccuracyMeters: row.gpsAccuracyMeters,
    gpsCapturedAt: row.gpsCapturedAt?.toISOString() ?? "",
    gpsPermissionStatus: row.gpsPermissionStatus as OutletValidation["gpsPermissionStatus"],
    distanceToOutletMeters: row.distanceToOutletMeters
  };
}

function statusCounts(validations: OutletValidation[]) {
  return {
    validCount: validations.filter((validation) => validation.status === "Valid").length,
    invalidCount: validations.filter((validation) => validation.status === "Invalid").length,
    needsUpdateCount: validations.filter((validation) => validation.status === "Needs Update").length,
    duplicateCount: validations.filter((validation) => validation.status === "Duplicate").length,
    gpsMissingCount: validations.filter((validation) => !validation.gpsLatitude || validation.gpsPermissionStatus === "denied" || validation.gpsPermissionStatus === "unavailable").length
  };
}

function normalizeValidation(body: OutletValidation, user: AuthUser): OutletValidation {
  return {
    ...body,
    validatedBy: user.name,
    reviewerId: user.id,
    validatedAt: new Date().toISOString(),
    fields: body.fields ?? {}
  };
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly groupRepository?: GroupRepository) {}

  async list(user: AuthUser) {
    if (canManageSessions(user)) {
      const rows = await getDb().select().from(validationSessions).orderBy(desc(validationSessions.updatedAt));
      return rows.map(toSummary);
    }

    const rows = await getDb()
      .select({ session: validationSessions })
      .from(validationSessions)
      .innerJoin(sessionAssignments, eq(sessionAssignments.sessionId, validationSessions.id))
      .where(eq(sessionAssignments.userId, user.id))
      .orderBy(desc(validationSessions.updatedAt));
    return rows.map(({ session }) => toSummary(session));
  }

  async create(body: CreateSessionBody, user: AuthUser) {
    assertCanManageSessions(user);
    const [row] = await getDb()
      .insert(validationSessions)
      .values({
        name: body.name,
        fileName: body.fileName,
        radiusKm: body.radiusKm ?? 5,
        config: body.config,
        outlets: body.outlets,
        validations: body.validations,
        outletCount: body.outlets.length,
        reviewedCount: countReviewed(body.validations)
      })
      .returning();

    if (body.outlets.length) {
      await getDb().insert(sessionOutlets).values(
        body.outlets.map((outlet) => ({
          sessionId: row.id,
          outletKey: outlet.outletKey,
          outletCode: outlet.id,
          outletName: outletName(outlet, row),
          latitude: outlet.latitude,
          longitude: outlet.longitude,
          rowIndex: outlet.rowIndex,
          rawData: outlet.originalData
        }))
      );
    }

    return toSummary(row);
  }

  async get(id: string, user: AuthUser) {
    const [row] = await getDb().select().from(validationSessions).where(eq(validationSessions.id, id));
    if (!row) return null;
    await this.assertCanAccess(row.id, user);

    const outletRows = await getDb().select().from(sessionOutlets).where(eq(sessionOutlets.sessionId, id));
    const validationRows = await getDb()
      .select({ validation: outletValidations, outlet: sessionOutlets, reviewer: users })
      .from(outletValidations)
      .innerJoin(sessionOutlets, eq(sessionOutlets.id, outletValidations.outletId))
      .innerJoin(users, eq(users.id, outletValidations.reviewerId))
      .where(eq(outletValidations.sessionId, id));

    const validations = validationRows.length
      ? Object.fromEntries(validationRows.map(({ validation, outlet, reviewer }) => [outlet.outletKey, toValidation(validation, reviewer)]))
      : row.validations;

    return {
      ...toSummary(row),
      config: row.config,
      outlets: outletRows.length ? outletRows.sort((a, b) => a.rowIndex - b.rowIndex).map(toOutlet) : row.outlets,
      validations
    };
  }

  async update(id: string, body: UpdateSessionBody, user: AuthUser) {
    assertCanManageSessions(user);
    const [existing] = await getDb().select().from(validationSessions).where(eq(validationSessions.id, id));
    if (!existing) return null;

    const patch: Partial<ValidationSessionRow> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.radiusKm !== undefined) patch.radiusKm = body.radiusKm;
    if (body.config !== undefined) patch.config = body.config;
    if (body.outlets !== undefined) {
      patch.outlets = body.outlets;
      patch.outletCount = body.outlets.length;
      await getDb().delete(sessionOutlets).where(eq(sessionOutlets.sessionId, id));
      if (body.outlets.length) {
        await getDb().insert(sessionOutlets).values(
          body.outlets.map((outlet) => ({
            sessionId: id,
            outletKey: outlet.outletKey,
            outletCode: outlet.id,
            outletName: outletName(outlet, { ...existing, config: body.config ?? existing.config }),
            latitude: outlet.latitude,
            longitude: outlet.longitude,
            rowIndex: outlet.rowIndex,
            rawData: outlet.originalData
          }))
        );
      }
    }
    if (body.validations !== undefined) {
      patch.validations = body.validations;
      patch.reviewedCount = countReviewed(body.validations);
    }
    patch.updatedAt = new Date();

    const [row] = await getDb().update(validationSessions).set(patch).where(eq(validationSessions.id, id)).returning();
    return row ? toSummary(row) : null;
  }

  async delete(id: string, user: AuthUser) {
    assertCanDelete(user);
    const deleted = await getDb().delete(validationSessions).where(eq(validationSessions.id, id)).returning({ id: validationSessions.id });
    return deleted.length > 0;
  }

  async assign(id: string, assignment: AssignmentsResponse, user: AuthUser) {
    assertCanManageSessions(user);
    await getDb().delete(sessionAssignments).where(eq(sessionAssignments.sessionId, id));
    await getDb().delete(sessionGroupAssignments).where(eq(sessionGroupAssignments.sessionId, id));
    if (assignment.userIds.length) {
      await getDb().insert(sessionAssignments).values(assignment.userIds.map((userId) => ({ sessionId: id, userId })));
    }
    if (assignment.groupIds.length) {
      await getDb().insert(sessionGroupAssignments).values(assignment.groupIds.map((groupId) => ({ sessionId: id, groupId })));
    }
    return assignment;
  }

  async getAssignments(id: string, user: AuthUser) {
    assertCanManageSessions(user);
    const [userRows, groupRows] = await Promise.all([
      getDb().select().from(sessionAssignments).where(eq(sessionAssignments.sessionId, id)),
      getDb().select().from(sessionGroupAssignments).where(eq(sessionGroupAssignments.sessionId, id))
    ]);
    return { userIds: userRows.map((row) => row.userId), groupIds: groupRows.map((row) => row.groupId) };
  }

  async upsertValidation(sessionId: string, outletKey: string, body: OutletValidation, user: AuthUser) {
    await this.assertCanAccess(sessionId, user);
    let [outlet] = await getDb().select().from(sessionOutlets).where(and(eq(sessionOutlets.sessionId, sessionId), eq(sessionOutlets.outletKey, outletKey)));
    if (!outlet) {
      const [session] = await getDb().select().from(validationSessions).where(eq(validationSessions.id, sessionId));
      const legacyOutlet = session?.outlets.find((item) => item.outletKey === outletKey);
      if (session && legacyOutlet) {
        [outlet] = await getDb()
          .insert(sessionOutlets)
          .values({
            sessionId,
            outletKey: legacyOutlet.outletKey,
            outletCode: legacyOutlet.id,
            outletName: outletName(legacyOutlet, session),
            latitude: legacyOutlet.latitude,
            longitude: legacyOutlet.longitude,
            rowIndex: legacyOutlet.rowIndex,
            rawData: legacyOutlet.originalData
          })
          .returning();
      }
    }
    if (!outlet) throw new HttpError(404, "Outlet not found");

    const normalized = normalizeValidation(body, user);
    const values = {
      sessionId,
      outletId: outlet.id,
      reviewerId: user.id,
      status: normalized.status,
      correctedValue: normalized.correctedValue ?? "",
      notes: normalized.generalComments,
      fields: normalized.fields,
      gpsLatitude: normalized.gpsLatitude ?? null,
      gpsLongitude: normalized.gpsLongitude ?? null,
      gpsAccuracyMeters: normalized.gpsAccuracyMeters ?? null,
      gpsCapturedAt: normalized.gpsCapturedAt ? new Date(normalized.gpsCapturedAt) : null,
      gpsPermissionStatus: normalized.gpsPermissionStatus ?? "",
      distanceToOutletMeters: normalized.distanceToOutletMeters ?? null,
      updatedAt: new Date()
    };
    await getDb()
      .insert(outletValidations)
      .values(values)
      .onConflictDoUpdate({
        target: [outletValidations.sessionId, outletValidations.outletId],
        set: values
      });

    const [session] = await getDb().select().from(validationSessions).where(eq(validationSessions.id, sessionId));
    const nextValidations = { ...(session?.validations ?? {}), [outletKey]: normalized };
    await getDb()
      .update(validationSessions)
      .set({ validations: nextValidations, reviewedCount: countReviewed(nextValidations), updatedAt: new Date() })
      .where(eq(validationSessions.id, sessionId));

    return normalized;
  }

  async dashboard(user: AuthUser, filters: { sessionId?: string; reviewerId?: string } = {}) {
    const sessions = await this.list(user);
    const filteredSessions = filters.sessionId ? sessions.filter((session) => session.id === filters.sessionId) : sessions;
    const sessionIds = filteredSessions.map((session) => session.id);
    if (!sessionIds.length) return emptyDashboard();

    const validationRows = await getDb().select().from(outletValidations).where(inArray(outletValidations.sessionId, sessionIds));
    const filteredValidationRows = filters.reviewerId ? validationRows.filter((row) => row.reviewerId === filters.reviewerId) : validationRows;
    const counts = statusCounts(filteredValidationRows.map((row) => toValidation(row, undefined)));
    const totalOutlets = filteredSessions.reduce((sum, session) => sum + session.outletCount, 0);
    const reviewedOutlets = filteredValidationRows.filter((validation) => validation.status).length;
    return {
      totalSessions: filteredSessions.length,
      activeSessions: filteredSessions.length,
      totalOutlets,
      reviewedOutlets,
      pendingOutlets: Math.max(totalOutlets - reviewedOutlets, 0),
      ...counts
    };
  }

  private async assertCanAccess(sessionId: string, user: AuthUser) {
    if (canManageSessions(user)) return;
    const [assignment] = await getDb().select().from(sessionAssignments).where(and(eq(sessionAssignments.sessionId, sessionId), eq(sessionAssignments.userId, user.id)));
    if (assignment) return;
    const groupIds = (await this.groupRepository?.groupsForUser(user.id)) ?? [];
    if (!groupIds.length) throw new HttpError(403, "Forbidden");
    const [groupAssignment] = await getDb().select().from(sessionGroupAssignments).where(and(eq(sessionGroupAssignments.sessionId, sessionId), inArray(sessionGroupAssignments.groupId, groupIds)));
    if (!groupAssignment) throw new HttpError(403, "Forbidden");
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, SessionDetail>();
  private readonly assignments = new Map<string, Set<string>>();
  private readonly groupAssignments = new Map<string, Set<string>>();

  constructor(private readonly groupRepository?: GroupRepository) {}

  async list(user: AuthUser) {
    const sessions = [...this.rows.values()];
    const userGroupIds = canManageSessions(user) ? [] : await this.groupRepository?.groupsForUser(user.id);
    return sessions
      .filter((session) => canManageSessions(user) || this.assignments.get(session.id)?.has(user.id) || [...(this.groupAssignments.get(session.id) ?? new Set<string>())].some((groupId) => userGroupIds?.includes(groupId)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ config: _config, outlets: _outlets, validations: _validations, ...summary }) => summary);
  }

  async create(body: CreateSessionBody, user: AuthUser) {
    assertCanManageSessions(user);
    const now = new Date().toISOString();
    const detail: SessionDetail = {
      id: randomUUID(),
      name: body.name,
      fileName: body.fileName,
      radiusKm: body.radiusKm ?? 5,
      outletCount: body.outlets.length,
      reviewedCount: countReviewed(body.validations),
      createdAt: now,
      updatedAt: now,
      config: body.config,
      outlets: body.outlets,
      validations: body.validations
    };
    this.rows.set(detail.id, detail);
    return this.toSummary(detail);
  }

  async get(id: string, user: AuthUser) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    await this.assertCanAccess(id, user);
    return existing;
  }

  async update(id: string, body: UpdateSessionBody, user: AuthUser) {
    assertCanManageSessions(user);
    const existing = this.rows.get(id);
    if (!existing) return null;

    const next: SessionDetail = {
      ...existing,
      ...body,
      radiusKm: body.radiusKm ?? existing.radiusKm,
      outletCount: body.outlets ? body.outlets.length : existing.outletCount,
      reviewedCount: body.validations ? countReviewed(body.validations) : existing.reviewedCount,
      updatedAt: new Date().toISOString()
    };
    this.rows.set(id, next);
    return this.toSummary(next);
  }

  async delete(id: string, user: AuthUser) {
    assertCanDelete(user);
    return this.rows.delete(id);
  }

  async assign(id: string, assignment: AssignmentsResponse, user: AuthUser) {
    assertCanManageSessions(user);
    if (!this.rows.has(id)) throw new HttpError(404, "Session not found");
    this.assignments.set(id, new Set(assignment.userIds));
    this.groupAssignments.set(id, new Set(assignment.groupIds));
    return assignment;
  }

  async getAssignments(id: string, user: AuthUser) {
    assertCanManageSessions(user);
    return { userIds: [...(this.assignments.get(id) ?? new Set<string>())], groupIds: [...(this.groupAssignments.get(id) ?? new Set<string>())] };
  }

  async upsertValidation(sessionId: string, outletKey: string, body: OutletValidation, user: AuthUser) {
    await this.assertCanAccess(sessionId, user);
    const existing = this.rows.get(sessionId);
    if (!existing) throw new HttpError(404, "Session not found");
    if (!existing.outlets.some((outlet) => outlet.outletKey === outletKey)) throw new HttpError(404, "Outlet not found");

    const normalized = normalizeValidation(body, user);
    const next: SessionDetail = {
      ...existing,
      validations: { ...existing.validations, [outletKey]: normalized },
      reviewedCount: countReviewed({ ...existing.validations, [outletKey]: normalized }),
      updatedAt: new Date().toISOString()
    };
    this.rows.set(sessionId, next);
    return normalized;
  }

  async dashboard(user: AuthUser, filters: { sessionId?: string; reviewerId?: string } = {}) {
    const sessions = await this.list(user);
    const filtered = filters.sessionId ? sessions.filter((session) => session.id === filters.sessionId) : sessions;
    const details = filtered.flatMap((session) => {
      const detail = this.rows.get(session.id);
      return detail ? [detail] : [];
    });
    const validations = details.flatMap((detail) => Object.values(detail.validations)).filter((validation) => !filters.reviewerId || validation.reviewerId === filters.reviewerId);
    const totalOutlets = details.reduce((sum, detail) => sum + detail.outletCount, 0);
    const reviewedOutlets = validations.filter((validation) => validation.status).length;
    return {
      totalSessions: details.length,
      activeSessions: details.length,
      totalOutlets,
      reviewedOutlets,
      pendingOutlets: Math.max(totalOutlets - reviewedOutlets, 0),
      ...statusCounts(validations)
    };
  }

  private toSummary(detail: SessionDetail): SessionSummary {
    return {
      id: detail.id,
      name: detail.name,
      fileName: detail.fileName,
      radiusKm: detail.radiusKm,
      outletCount: detail.outletCount,
      reviewedCount: detail.reviewedCount,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    };
  }

  private async assertCanAccess(sessionId: string, user: AuthUser) {
    if (canManageSessions(user)) return;
    if (this.assignments.get(sessionId)?.has(user.id)) return;
    const assignedGroupIds = this.groupAssignments.get(sessionId) ?? new Set<string>();
    const userGroupIds = (await this.groupRepository?.groupsForUser(user.id)) ?? [];
    if ([...assignedGroupIds].some((groupId) => userGroupIds.includes(groupId))) return;
    throw new HttpError(403, "Forbidden");
  }
}

function emptyDashboard(): DashboardMetrics {
  return {
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
}

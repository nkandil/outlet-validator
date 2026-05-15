import { getDb, groupMembers, groups, type GroupRow, type UserGroup } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { HttpError } from "../http-error";

export interface GroupRepository {
  list(): Promise<UserGroup[]>;
  create(body: { name: string; description?: string }): Promise<UserGroup>;
  update(id: string, body: { name?: string; description?: string }): Promise<UserGroup | null>;
  delete(id: string): Promise<boolean>;
  getMembers(id: string): Promise<{ userIds: string[] }>;
  setMembers(id: string, userIds: string[]): Promise<{ userIds: string[] }>;
  groupsForUser(userId: string): Promise<string[]>;
}

function toGroup(row: GroupRow): UserGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function asDatabaseSetupError(error: unknown): HttpError {
  const message = error instanceof Error ? error.message : String(error);
  return new HttpError(
    503,
    "Database is not ready. Run `pnpm --filter @workspace/db run push`, confirm DATABASE_URL points to PostgreSQL, then restart the API server.",
    message
  );
}

export class PostgresGroupRepository implements GroupRepository {
  async list() {
    try {
      const rows = await getDb().select().from(groups);
      return rows.map(toGroup).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async create(body: { name: string; description?: string }) {
    try {
      const [row] = await getDb()
        .insert(groups)
        .values({ name: body.name.trim(), description: body.description?.trim() ?? "" })
        .returning();
      return toGroup(row);
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async update(id: string, body: { name?: string; description?: string }) {
    try {
      const patch: Partial<GroupRow> = { updatedAt: new Date() };
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.description !== undefined) patch.description = body.description.trim();
      const [row] = await getDb().update(groups).set(patch).where(eq(groups.id, id)).returning();
      return row ? toGroup(row) : null;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async delete(id: string) {
    try {
      const deleted = await getDb().delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
      return deleted.length > 0;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async getMembers(id: string) {
    try {
      const rows = await getDb().select().from(groupMembers).where(eq(groupMembers.groupId, id));
      return { userIds: rows.map((row) => row.userId) };
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async setMembers(id: string, userIds: string[]) {
    try {
      await getDb().delete(groupMembers).where(eq(groupMembers.groupId, id));
      if (userIds.length) {
        await getDb().insert(groupMembers).values(userIds.map((userId) => ({ groupId: id, userId })));
      }
      return { userIds };
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async groupsForUser(userId: string) {
    try {
      const rows = await getDb().select().from(groupMembers).where(eq(groupMembers.userId, userId));
      return rows.map((row) => row.groupId);
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }
}

export class InMemoryGroupRepository implements GroupRepository {
  private readonly rows = new Map<string, UserGroup>();
  private readonly members = new Map<string, Set<string>>();

  async list() {
    return [...this.rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(body: { name: string; description?: string }) {
    const now = new Date().toISOString();
    const group: UserGroup = {
      id: randomUUID(),
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      createdAt: now,
      updatedAt: now
    };
    this.rows.set(group.id, group);
    return group;
  }

  async update(id: string, body: { name?: string; description?: string }) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = {
      ...existing,
      name: body.name !== undefined ? body.name.trim() : existing.name,
      description: body.description !== undefined ? body.description.trim() : existing.description,
      updatedAt: new Date().toISOString()
    };
    this.rows.set(id, next);
    return next;
  }

  async delete(id: string) {
    this.members.delete(id);
    return this.rows.delete(id);
  }

  async getMembers(id: string) {
    if (!this.rows.has(id)) throw new HttpError(404, "Group not found");
    return { userIds: [...(this.members.get(id) ?? new Set<string>())] };
  }

  async setMembers(id: string, userIds: string[]) {
    if (!this.rows.has(id)) throw new HttpError(404, "Group not found");
    this.members.set(id, new Set(userIds));
    return { userIds };
  }

  async groupsForUser(userId: string) {
    return [...this.members.entries()].filter(([, userIds]) => userIds.has(userId)).map(([groupId]) => groupId);
  }
}

import { getDb, users, type AuthUser, type CreateUserBody, type UserRole, type UserRow } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { HttpError } from "../http-error";
import { hashPassword, verifyPassword } from "./crypto";

export interface UserRepository {
  findByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null>;
  findById(id: string): Promise<AuthUser | null>;
  list(role?: UserRole, includeInactive?: boolean): Promise<AuthUser[]>;
  create(body: CreateUserBody): Promise<AuthUser>;
  updateRole(id: string, role: UserRole): Promise<AuthUser | null>;
  updatePassword(id: string, password: string): Promise<AuthUser | null>;
  deactivate(id: string): Promise<AuthUser | null>;
  ensureSeedAdmin(): Promise<void>;
}

function toAuthUser(row: UserRow): AuthUser & { passwordHash: string } {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    passwordHash: row.passwordHash
  };
}

function withoutPassword(user: AuthUser & { passwordHash: string }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    disabledAt: user.disabledAt ?? null
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

export class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string) {
    try {
      const [row] = await getDb().select().from(users).where(eq(users.email, email.toLowerCase()));
      return row ? toAuthUser(row) : null;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async findById(id: string) {
    try {
      const [row] = await getDb().select().from(users).where(eq(users.id, id));
      if (!row || !row.isActive) return null;
      return toAuthUser(row);
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async list(role?: UserRole, includeInactive = false) {
    try {
      const query = getDb().select().from(users);
      const rows = role ? await query.where(eq(users.role, role)) : await query;
      return rows
        .filter((row) => includeInactive || row.isActive)
        .map(toAuthUser)
        .map(withoutPassword);
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async create(body: CreateUserBody) {
    try {
      const email = body.email.trim().toLowerCase();
      const existing = await this.findByEmail(email);
      if (existing) throw new HttpError(409, "User email already exists");
      const [row] = await getDb()
        .insert(users)
        .values({
          name: body.name.trim(),
          email,
          role: body.role,
          isActive: true,
          disabledAt: null,
          passwordHash: hashPassword(body.password)
        })
        .returning();
      return withoutPassword(toAuthUser(row));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw asDatabaseSetupError(error);
    }
  }

  async updateRole(id: string, role: UserRole) {
    try {
      const [row] = await getDb().update(users).set({ role }).where(eq(users.id, id)).returning();
      return row && row.isActive ? withoutPassword(toAuthUser(row)) : null;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async updatePassword(id: string, password: string) {
    try {
      const [row] = await getDb()
        .update(users)
        .set({ passwordHash: hashPassword(password) })
        .where(and(eq(users.id, id), eq(users.isActive, true)))
        .returning();
      return row ? withoutPassword(toAuthUser(row)) : null;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async deactivate(id: string) {
    try {
      const [row] = await getDb().update(users).set({ isActive: false, disabledAt: new Date() }).where(eq(users.id, id)).returning();
      return row ? withoutPassword(toAuthUser(row)) : null;
    } catch (error) {
      throw asDatabaseSetupError(error);
    }
  }

  async ensureSeedAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME?.trim() || "Admin";
    if (!email || !password) return;

    try {
      const existing = await this.findByEmail(email);
      if (existing) return;

      await getDb().insert(users).values({
        name,
        email,
        role: "admin",
        isActive: true,
        disabledAt: null,
        passwordHash: hashPassword(password)
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw asDatabaseSetupError(error);
    }
  }
}

interface SeedUser {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, AuthUser & { passwordHash: string }>();

  constructor({ seedUsers = [] }: { jwtSecret?: string; seedUsers?: SeedUser[] } = {}) {
    for (const user of seedUsers) {
      const id = user.id ?? randomUUID();
      this.rows.set(id, {
        id,
        name: user.name,
        email: user.email.toLowerCase(),
        role: user.role,
        isActive: true,
        disabledAt: null,
        passwordHash: hashPassword(user.password)
      });
    }
  }

  async findByEmail(email: string) {
    return [...this.rows.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string) {
    const user = this.rows.get(id);
    return user?.isActive === false ? null : user ?? null;
  }

  async list(role?: UserRole, includeInactive = false) {
    return [...this.rows.values()].filter((user) => (includeInactive || user.isActive !== false) && (!role || user.role === role)).map(withoutPassword);
  }

  async create(body: CreateUserBody) {
    const email = body.email.trim().toLowerCase();
    if (await this.findByEmail(email)) throw new HttpError(409, "User email already exists");
    const id = randomUUID();
    const user = {
      id,
      name: body.name.trim(),
      email,
      role: body.role,
      isActive: true,
      disabledAt: null,
      passwordHash: hashPassword(body.password)
    };
    this.rows.set(id, user);
    return withoutPassword(user);
  }

  async updateRole(id: string, role: UserRole) {
    const user = this.rows.get(id);
    if (!user || user.isActive === false) return null;
    const next = { ...user, role };
    this.rows.set(id, next);
    return withoutPassword(next);
  }

  async updatePassword(id: string, password: string) {
    const user = this.rows.get(id);
    if (!user || user.isActive === false) return null;
    const next = { ...user, passwordHash: hashPassword(password) };
    this.rows.set(id, next);
    return withoutPassword(next);
  }

  async deactivate(id: string) {
    const user = this.rows.get(id);
    if (!user) return null;
    const next = { ...user, isActive: false, disabledAt: new Date().toISOString() };
    this.rows.set(id, next);
    return withoutPassword(next);
  }

  async ensureSeedAdmin() {
    return undefined;
  }

  async verifyLogin(email: string, password: string) {
    const user = await this.findByEmail(email);
    return user && user.isActive !== false && verifyPassword(password, user.passwordHash) ? user : null;
  }
}

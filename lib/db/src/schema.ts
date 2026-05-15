import { boolean, doublePrecision, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { FieldValidation, Outlet, OutletValidation, SessionConfig, UserRole } from "./types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").$type<UserRole>().notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const validationSessions = pgTable("validation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  radiusKm: real("radius_km").notNull().default(5),
  config: jsonb("config").$type<SessionConfig>().notNull(),
  outlets: jsonb("outlets").$type<Outlet[]>().notNull(),
  validations: jsonb("validations").$type<Record<string, OutletValidation>>().notNull(),
  outletCount: integer("outlet_count").notNull().default(0),
  reviewedCount: integer("reviewed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => validationSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("session_assignments_session_user_idx").on(table.sessionId, table.userId),
    index("session_assignments_user_idx").on(table.userId)
  ]
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("group_members_group_user_idx").on(table.groupId, table.userId),
    index("group_members_user_idx").on(table.userId)
  ]
);

export const sessionGroupAssignments = pgTable(
  "session_group_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => validationSessions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("session_group_assignments_session_group_idx").on(table.sessionId, table.groupId),
    index("session_group_assignments_group_idx").on(table.groupId)
  ]
);

export const sessionOutlets = pgTable(
  "outlets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => validationSessions.id, { onDelete: "cascade" }),
    outletKey: text("outlet_key").notNull(),
    outletCode: text("outlet_code").notNull(),
    outletName: text("outlet_name").notNull().default(""),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    rowIndex: integer("row_index").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [uniqueIndex("outlets_session_key_idx").on(table.sessionId, table.outletKey)]
);

export const outletValidations = pgTable(
  "validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => validationSessions.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => sessionOutlets.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status").$type<OutletValidation["status"]>().notNull().default(""),
    correctedValue: text("corrected_value").notNull().default(""),
    notes: text("notes").notNull().default(""),
    fields: jsonb("fields").$type<Record<string, FieldValidation>>().notNull().default({}),
    gpsLatitude: doublePrecision("gps_latitude"),
    gpsLongitude: doublePrecision("gps_longitude"),
    gpsAccuracyMeters: real("gps_accuracy_meters"),
    gpsCapturedAt: timestamp("gps_captured_at", { withTimezone: true }),
    gpsPermissionStatus: text("gps_permission_status").notNull().default(""),
    distanceToOutletMeters: real("distance_to_outlet_meters"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  (table) => [
    uniqueIndex("validations_session_outlet_idx").on(table.sessionId, table.outletId),
    index("validations_outlet_idx").on(table.outletId),
    index("validations_reviewer_idx").on(table.reviewerId)
  ]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type GroupRow = typeof groups.$inferSelect;
export type NewGroupRow = typeof groups.$inferInsert;
export type ValidationSessionRow = typeof validationSessions.$inferSelect;
export type NewValidationSessionRow = typeof validationSessions.$inferInsert;
export type SessionOutletRow = typeof sessionOutlets.$inferSelect;
export type NewSessionOutletRow = typeof sessionOutlets.$inferInsert;
export type OutletValidationRow = typeof outletValidations.$inferSelect;
export type NewOutletValidationRow = typeof outletValidations.$inferInsert;

import { config as loadEnv } from "dotenv";
import { and, eq, like } from "drizzle-orm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, getPool, users, validationSessions } from "@workspace/db";
import { PostgresUserRepository } from "./auth/repository";
import { PostgresSessionRepository } from "./sessions/repository";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });
loadEnv({ path: resolve(here, "../.env"), override: true });
process.env.DEMO_MODE = "false";

const runId = `codex-validation-${Date.now()}`;
const adminEmail = `${runId}-admin@example.com`;
const reviewerEmail = `${runId}-reviewer@example.com`;
const archivedEmail = `${runId}-archived@example.com`;
const password = "temporary-password";

const config = {
  confirmedMapping: {
    id: "id",
    lat: "lat",
    lng: "lng",
    displayField: "name",
    colorByField: "",
    colorByValues: {},
    shapeByField: "",
    shapeByValues: {}
  },
  visibleFields: ["name", "channel"],
  fieldsToVerify: ["name"],
  reviewerName: "",
  rawHeaders: ["id", "lat", "lng", "name", "channel"]
};

const outlets = [
  {
    outletKey: "A__row_0",
    rowIndex: 0,
    id: "A",
    latitude: 30,
    longitude: 31,
    originalData: { id: "A", lat: 30, lng: 31, name: "Alpha Market", channel: "Cafe" },
    distanceKm: null
  },
  {
    outletKey: "B__row_1",
    rowIndex: 1,
    id: "B",
    latitude: 30.01,
    longitude: 31.01,
    originalData: { id: "B", lat: 30.01, lng: 31.01, name: "Bravo Market", channel: "Restaurant" },
    distanceKm: null
  }
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function cleanup(prefix = runId) {
  const db = getDb();
  await db.delete(validationSessions).where(like(validationSessions.name, `${prefix}%`));
  await db.delete(users).where(like(users.email, `${prefix}%`));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for real database smoke validation.");

  const userRepository = new PostgresUserRepository();
  const sessionRepository = new PostgresSessionRepository();

  await cleanup();

  const admin = await userRepository.create({ name: `${runId} Admin`, email: adminEmail, role: "admin", password });
  const reviewer = await userRepository.create({ name: `${runId} Reviewer`, email: reviewerEmail, role: "reviewer", password });
  assert(admin.email === adminEmail, "admin user was not saved with the expected email");
  assert(reviewer.email === reviewerEmail, "reviewer user was not saved with the expected email");

  const loadedReviewer = await userRepository.findByEmail(reviewerEmail);
  assert(loadedReviewer?.id === reviewer.id, "created reviewer could not be loaded by email");

  const archived = await userRepository.create({ name: `${runId} Archived`, email: archivedEmail, role: "reviewer", password });
  await userRepository.deactivate(archived.id);
  const archivedUsers = await userRepository.list(undefined, true);
  assert(archivedUsers.some((user) => user.id === archived.id && user.isActive === false), "archived user was not returned when inactive users were included");
  const reactivated = await userRepository.create({ name: `${runId} Restored`, email: archivedEmail, role: "coordinator", password: "reactivated-password" });
  assert(reactivated.id === archived.id && reactivated.isActive !== false && reactivated.role === "coordinator", "creating with an archived email did not reactivate the user");
  await userRepository.deactivate(archived.id);
  assert(await userRepository.hardDelete(archived.id), "permanent delete did not remove archived smoke user");

  const session = await sessionRepository.create(
    {
      name: `${runId} session`,
      fileName: `${runId}.xlsx`,
      radiusKm: 5,
      config,
      outlets,
      validations: {}
    },
    admin
  );
  assert(session.outletCount === 2, "session did not save the expected outlet count");

  const listed = await sessionRepository.list(admin);
  assert(listed.some((item) => item.id === session.id), "created session was not returned by list");

  const detail = await sessionRepository.get(session.id, admin);
  assert(detail?.outlets.length === 2, "created session did not load saved outlets");
  assert(detail.config.visibleFields.includes("channel"), "session config did not load visible fields");

  await sessionRepository.assign(session.id, { userIds: [reviewer.id], groupIds: [] }, admin);
  const reviewerDetail = await sessionRepository.get(session.id, reviewer);
  assert(reviewerDetail?.id === session.id, "assigned reviewer could not load the session");

  await sessionRepository.upsertValidation(
    session.id,
    "A__row_0",
    {
      status: "Valid",
      generalComments: "Smoke validation",
      correctedValue: "",
      validatedBy: "",
      validatedAt: "",
      reviewerId: reviewer.id,
      gpsPermissionStatus: "granted",
      gpsLatitude: 30,
      gpsLongitude: 31,
      gpsAccuracyMeters: 10,
      gpsCapturedAt: "2026-05-18T00:00:00.000Z",
      distanceToOutletMeters: 0,
      fields: {}
    },
    reviewer
  );

  const validated = await sessionRepository.get(session.id, admin);
  assert(validated?.validations.A__row_0?.status === "Valid", "validation did not persist after reload");
  assert(validated.reviewedCount === 1, "reviewed count did not update after validation");

  const deleted = await sessionRepository.delete(session.id, admin);
  assert(deleted, "session delete returned false");
  assert((await sessionRepository.get(session.id, admin)) === null, "deleted session was still loadable");

  await userRepository.deactivate(reviewer.id);
  const inactiveReviewer = await userRepository.findById(reviewer.id);
  assert(inactiveReviewer === null, "deactivated user remained active");

  await cleanup();

  const leftovers = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(like(users.email, `${runId}%`), eq(users.isActive, true)));
  assert(leftovers.length === 0, "active smoke users remained after cleanup");

  console.log(`Real database smoke validation passed for ${runId}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });

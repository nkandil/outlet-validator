import { z } from "zod";

const fieldValidationSchema = z.object({
  status: z.enum(["Valid", "Invalid", "Not Sure", ""]).default(""),
  correctedValue: z.string().default(""),
  comment: z.string().default("")
});

const outletValidationSchema = z.object({
  status: z.enum(["Valid", "Needs Update", "Invalid", "Duplicate", "Could Not Verify", ""]).default(""),
  generalComments: z.string().default(""),
  correctedValue: z.string().default("").optional(),
  validatedBy: z.string().default(""),
  validatedAt: z.string().default(""),
  reviewerId: z.string().optional(),
  gpsLatitude: z.number().nullable().optional(),
  gpsLongitude: z.number().nullable().optional(),
  gpsAccuracyMeters: z.number().nullable().optional(),
  gpsCapturedAt: z.string().default("").optional(),
  gpsPermissionStatus: z.enum(["granted", "denied", "unavailable", ""]).default("").optional(),
  distanceToOutletMeters: z.number().nullable().optional(),
  fields: z.record(z.string(), fieldValidationSchema).default({})
});

const confirmedMappingSchema = z.object({
  id: z.string(),
  lat: z.string(),
  lng: z.string(),
  displayField: z.string().default(""),
  colorByField: z.string().default(""),
  colorByValues: z.record(z.string(), z.string()).default({}),
  shapeByField: z.string().default(""),
  shapeByValues: z.record(z.string(), z.string()).default({})
});

const sessionConfigSchema = z.object({
  confirmedMapping: confirmedMappingSchema,
  visibleFields: z.array(z.string()).default([]),
  fieldsToVerify: z.array(z.string()).default([]),
  reviewerName: z.string().default(""),
  rawHeaders: z.array(z.string()).default([])
});

const outletSchema = z.object({
  outletKey: z.string(),
  rowIndex: z.number().int().nonnegative(),
  id: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  originalData: z.record(z.string(), z.unknown()),
  distanceKm: z.number().nullable()
});

export const createSessionSchema = z.object({
  name: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  radiusKm: z.number().positive().default(5).optional(),
  config: sessionConfigSchema,
  outlets: z.array(outletSchema),
  validations: z.record(z.string(), outletValidationSchema).default({})
});

export const updateSessionSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    radiusKm: z.number().positive().optional(),
    config: sessionConfigSchema.optional(),
    outlets: z.array(outletSchema).optional(),
    validations: z.record(z.string(), outletValidationSchema).optional()
  })
  .refine((body) => Object.keys(body).length > 0, "At least one field is required");

export const assignmentSchema = z.object({
  userIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([])
});

export const upsertValidationSchema = outletValidationSchema;

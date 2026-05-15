# Outlet Validator — Coding Agent Handoff Spec

## 1. Product Summary

**App name:** Outlet Validator  
**Audience:** Coca-Cola HBC field teams validating outlet master data in the field.  
**Primary form factor:** Mobile-first web app.  
**Core job:** Let users upload an outlet Excel/CSV file, map key columns, configure review fields, find nearby outlets on a map/list, validate each outlet, sync validations to a shared database, and export the validated file.

The current project is a TypeScript monorepo with a React/Vite frontend, Express API server, PostgreSQL persistence through Drizzle ORM, and OpenAPI-driven generated clients/schemas.

---

## 2. Success Criteria

A coding agent should preserve and complete the following end-to-end outcome:

1. A user can start a new validation session from an uploaded `.xlsx`, `.xls`, or `.csv` outlet file.
2. The app detects or allows manual mapping of outlet ID, latitude, and longitude columns.
3. The app lets the user configure display fields, pin colors, pin shapes, visible outlet-card fields, and per-field verification fields.
4. The app creates or updates a shared validation session in PostgreSQL.
5. Any user opening the app can see saved sessions, open one, rename it, delete it, and continue validation.
6. In field mode, the user can grant GPS permission or manually enter coordinates.
7. The app shows nearby outlets within 5 km, sorted by distance, in both list and map views.
8. The user can review each outlet, set outlet-level status, verify selected fields, add comments/corrections, and save.
9. Saved validations persist locally and sync to the backend when available.
10. The user can export an Excel workbook containing original outlet data plus validation metadata.

---

## 3. Existing Stack and Project Layout

### Stack

- Package manager: `pnpm` workspaces.
- Runtime/language: Node.js 24, TypeScript 5.9.
- Frontend: React, Vite, Tailwind CSS, Shadcn UI, Zustand.
- Maps: React Leaflet, Leaflet, OpenStreetMap tiles.
- Excel/CSV: SheetJS `xlsx`.
- API: Express 5.
- Database: PostgreSQL using Drizzle ORM.
- Validation/codegen: OpenAPI 3.1, Orval, Zod, drizzle-zod.

### Key folders

- `artifacts/outlet-validator/` — React/Vite frontend.
- `artifacts/api-server/` — Express API server.
- `lib/db/` — Drizzle schema and database client.
- `lib/api-spec/openapi.yaml` — API contract.
- `lib/api-zod/` — generated server-side Zod schemas.
- `lib/api-client-react/` — generated React Query API client.

### Important runtime commands

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/outlet-validator run dev
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

### Required environment

```bash
DATABASE_URL=<postgres connection string>
PORT=<api server port>
```

---

## 4. Product Scope

### In scope

- Session management.
- Excel/CSV upload and sheet selection.
- Column detection and manual mapping.
- Valid coordinate filtering.
- Optional display field selection.
- Optional map pin color/shape rules by source field values.
- Visible outlet-card field selection.
- Field-level verification configuration.
- Reviewer attribution.
- Location detection/manual location input.
- Nearby outlet filtering within 5 km.
- List and map views.
- Outlet-level and field-level validation capture.
- Local offline-safe persistence.
- Backend session sync.
- Excel export.

### Out of scope in current implementation

- Authentication and authorization.
- Role-based access.
- True offline queue/retry management beyond local persistence and best-effort API calls.
- Server-side file storage.
- Geocoding/address lookup.
- Route optimization.
- Multi-reviewer conflict resolution.
- Audit history per validation change.
- Bulk edit workflows.

---

## 5. User Roles / Personas

### Field reviewer

- Uses a mobile device while visiting outlets.
- Needs to find nearby outlets quickly.
- Needs a simple validation form.
- Needs validations preserved even if network is unstable.

### Team lead / coordinator

- Prepares or uploads outlet datasets.
- Configures fields to validate.
- Opens shared validation sessions.
- Exports final results for analysis or upload back into master data systems.

---

## 6. End-to-End User Flow

### Step 0 — Session Picker

**Source file:** `artifacts/outlet-validator/src/pages/Step0SessionPicker.tsx`

Purpose: Landing screen for all users.

Requirements:

- Display app header: `Outlet Validator`, subtitle `Coca-Cola HBC Field Teams`.
- Load session summaries from `GET /api/sessions`.
- Show loading, empty, and error states.
- Allow refresh.
- Allow creating a new session, which resets Zustand state and moves to Step 1.
- Show saved sessions with:
  - session name,
  - file name,
  - outlet count,
  - reviewed count,
  - created/updated date metadata where available.
- Allow opening a session:
  - call `GET /api/sessions/:id`,
  - populate store with session config, outlets, validations, file name, headers,
  - move directly to map view, Step 7.
- Allow renaming a session inline:
  - call `PATCH /api/sessions/:id` with `{ name }`.
- Allow deleting a session:
  - call `DELETE /api/sessions/:id`,
  - remove locally from session list after success.

Acceptance criteria:

- A user with no sessions sees an empty state and a “Start New Session” action.
- A user with sessions can open, rename, delete, and refresh.
- Opening a session lands directly in Step 7 with prior validations loaded.

---

### Step 1 — Upload Outlet Data

**Source file:** `artifacts/outlet-validator/src/pages/Step1Upload.tsx`

Purpose: Import outlet file into browser memory.

Requirements:

- Accept `.xlsx`, `.xls`, and `.csv` files.
- Support tap-to-upload and drag/drop.
- Use mobile-safe `<label htmlFor>` pattern instead of hidden input programmatic click.
- Validate file extension before parsing.
- Parse file using SheetJS.
- For multi-sheet workbooks, allow sheet selection.
- Store:
  - workbook object,
  - sheet names,
  - selected sheet,
  - raw headers,
  - raw rows,
  - file name.
- Show file name and number of loaded rows.
- Allow replacing the selected file.
- Continue only when a valid file has at least one row.

Acceptance criteria:

- Valid Excel/CSV files load and reveal row count.
- Invalid file types show an error.
- Multi-sheet files expose a sheet selector and reload rows when changed.

---

### Step 2 — Auto-Detect Required Columns

**Source files:**

- `artifacts/outlet-validator/src/pages/Step2Detect.tsx`
- `artifacts/outlet-validator/src/lib/schema-detect.ts`

Purpose: Identify core fields before manual confirmation.

Detection aliases:

- ID: `id`, `outlet_id`, `customer_id`, `lead_id`, `code`, `store_id`, `outletid`, `outlet id`, `customer id`.
- Latitude: `lat`, `latitude`, `y`, `gps_lat`, `gps_latitude`.
- Longitude: `lng`, `lon`, `long`, `longitude`, `x`, `gps_long`, `gps_longitude`.

Requirements:

- Display detection status for Outlet ID, Latitude, Longitude.
- Store detected mapping in Zustand.
- If all are detected, continue button says `Continue`.
- If any are missing, continue button says `Review Mappings`.
- User can proceed either way because Step 3 supports manual mapping.

Acceptance criteria:

- Known aliases are auto-populated.
- Missing columns are clearly marked and do not block moving to manual mapping.

---

### Step 3 — Map Fields and Configure Map Pins

**Source files:**

- `artifacts/outlet-validator/src/pages/Step3MapFields.tsx`
- `artifacts/outlet-validator/src/lib/geo.ts`

Purpose: Confirm required fields, generate outlet records, configure display and map visualization.

Required mappings:

- Outlet ID column.
- Latitude column.
- Longitude column.

Optional mappings:

- Display name column.
- Color pins by field.
- Shape pins by field.

Validation rules:

- Latitude must be a number between `-90` and `90`.
- Longitude must be a number between `-180` and `180`.
- Continue is disabled unless ID, latitude, longitude are selected and at least one row has valid coordinates.
- Duplicate outlet IDs show a warning but do not block continuation.

Processed outlet shape:

```ts
interface Outlet {
  rowIndex: number;
  id: string;
  latitude: number;
  longitude: number;
  originalData: Record<string, unknown>;
  distanceKm: number | null;
}
```

Pin customization:

- Preset colors:
  - `#F40009`, `#2563eb`, `#16a34a`, `#d97706`, `#7c3aed`, `#0891b2`, `#db2777`, `#ca8a04`.
- Custom color picker supported per distinct field value.
- Supported pin shapes:
  - `circle`, `square`, `diamond`, `triangle`.
- Distinct values are capped at 50 for configuration UI.

Backend behavior:

- Save session as early as Step 3.
- If `sessionId` exists, call `PATCH /api/sessions/:id` with config and outlets.
- Otherwise call `POST /api/sessions` using file name as default session name.
- If save fails, continue offline and show a non-blocking warning.

Acceptance criteria:

- Invalid coordinate rows are excluded from processed outlets.
- Valid row count is shown.
- Session is created/updated when backend is reachable.
- User can continue offline if backend is unreachable.

---

### Step 4 — Select Visible Fields

**Source file:** `artifacts/outlet-validator/src/pages/Step4VisibleFields.tsx`

Purpose: Decide what non-coordinate fields appear during outlet review.

Requirements:

- Available fields exclude selected ID, latitude, longitude columns.
- Default selection is all available fields unless the session already has saved visible fields.
- User can toggle individual fields.
- User can select all/deselect all.
- Continue is disabled if available fields exist and none are selected.
- Save selected fields into store and move to Step 5.

Acceptance criteria:

- Required mapping fields are not selectable as visible fields.
- Selected visible fields appear later in review overlay.

---

### Step 5 — Select Fields to Verify

**Source file:** `artifacts/outlet-validator/src/pages/Step5VerifyFields.tsx`

Purpose: Decide which visible fields need explicit field-level validation.

Requirements:

- List only fields selected in Step 4.
- User can toggle any field as “Verify”.
- Selected fields show a visual badge.
- Zero selected verification fields is allowed.
- Save selected fields into store and move to Step 6.

Acceptance criteria:

- Only selected visible fields can be marked for verification.
- Step 8 review overlay shows verification controls only for these fields.

---

### Step 6 — Reviewer Information

**Source file:** `artifacts/outlet-validator/src/pages/Step6ReviewerName.tsx`

Purpose: Attribute validations to a reviewer.

Requirements:

- Require a non-empty full name.
- Store reviewer name in Zustand.
- Update existing session config when `sessionId` exists.
- Create a fallback session if Step 3 save failed or was skipped.
- If backend save fails, continue offline and show warning.
- Continue to Step 7.

Acceptance criteria:

- User cannot start validation without entering a name.
- Exported records include reviewer name.
- Backend failures do not block field work.

---

### Step 7 — Map/List Field Validation View

**Source file:** `artifacts/outlet-validator/src/pages/Step7MapView.tsx`

Purpose: Main field-work interface.

Requirements:

- Full-height mobile-first view.
- Tabs:
  - List.
  - Map.
- Request geolocation on mount if no location exists.
- If location permission is denied/unavailable:
  - show clear warning,
  - allow manual latitude/longitude input.
- Allow refresh current location.
- Compute distance from user to outlet using Haversine formula.
- Filter outlets to those within 5 km when user location is known.
- Sort nearby outlets by distance ascending.
- List tab requirements:
  - filters: All, Unreviewed, Reviewed,
  - search by outlet ID, display field, and visible fields,
  - show OutletCard for each filtered outlet,
  - show empty state when no nearby outlets match.
- Map tab requirements:
  - use OpenStreetMap tile layer,
  - show user location marker when available,
  - show outlet markers for filtered outlets,
  - marker color/shape follows configured mapping,
  - default marker color is red for unreviewed and green for reviewed,
  - marker popup shows outlet display name/ID, distance, and review action,
  - show legend for either configured colors/shapes or default reviewed/unreviewed/user markers.
- Export button available from toolbar.

Acceptance criteria:

- User sees nearby outlets within 5 km once location is available.
- Manual coordinates work when GPS is unavailable.
- List and map filters remain consistent.
- Tapping/clicking an outlet opens the outlet review overlay.

---

### Step 8 — Outlet Review Overlay

**Source file:** `artifacts/outlet-validator/src/pages/Step8OutletReview.tsx`

Purpose: Capture outlet-level and field-level validation.

Outlet status options:

- `Valid`
- `Needs Update`
- `Invalid Lead`
- `Duplicate`
- `Could Not Verify`

Field status options:

- `Valid`
- `Invalid`
- `Not Sure`

Requirements:

- Show outlet ID and coordinates.
- Show outlet distance if available.
- Show visible fields from Step 4.
- Show field-level validation cards for fields selected in Step 5.
- For each field to verify:
  - show source value,
  - allow status selection,
  - if status is `Invalid` or `Not Sure`, show corrected value and comment inputs.
- Allow general outlet comments.
- Save behavior:
  - update local Zustand persisted state first,
  - then attempt backend sync using `PATCH /api/sessions/:id` with latest validations,
  - silently tolerate backend failure because local data is already saved.
- Close overlay after save.

Acceptance criteria:

- Outlet status and comments persist locally.
- Field-level statuses/corrections/comments persist locally.
- Backend `reviewedCount` updates after successful sync.
- Closing without saving does not persist unsaved overlay edits.

---

## 7. Data Model

### Frontend domain types

```ts
interface FieldValidation {
  status: 'Valid' | 'Invalid' | 'Not Sure' | '';
  correctedValue: string;
  comment: string;
}

interface OutletValidation {
  status: 'Valid' | 'Needs Update' | 'Invalid Lead' | 'Duplicate' | 'Could Not Verify' | '';
  generalComments: string;
  validatedBy: string;
  validatedAt: string;
  fields: Record<string, FieldValidation>;
}

interface Outlet {
  rowIndex: number;
  id: string;
  latitude: number;
  longitude: number;
  originalData: Record<string, unknown>;
  distanceKm: number | null;
}

interface ConfirmedMapping {
  id: string;
  lat: string;
  lng: string;
  displayField: string;
  colorByField: string;
  colorByValues: Record<string, string>;
  shapeByField: string;
  shapeByValues: Record<string, string>;
}
```

### Session config

```ts
interface SessionConfig {
  confirmedMapping: ConfirmedMapping;
  visibleFields: string[];
  fieldsToVerify: string[];
  reviewerName: string;
  rawHeaders: string[];
}
```

### PostgreSQL table

Table: `validation_sessions`

Columns:

- `id uuid primary key defaultRandom()`
- `name text not null`
- `file_name text not null`
- `config jsonb not null`
- `outlets jsonb not null`
- `validations jsonb not null`
- `outlet_count integer not null default 0`
- `reviewed_count integer not null default 0`
- `created_at timestamp with time zone default now()`
- `updated_at timestamp with time zone default now()` with Drizzle `$onUpdate(() => new Date())`

---

## 8. API Specification

Base path: `/api`

### `GET /healthz`

Returns health status.

Response:

```json
{ "status": "ok" }
```

### `GET /sessions`

Returns session summaries sorted by `updatedAt` descending.

Response item:

```ts
interface SessionSummary {
  id: string;
  name: string;
  fileName: string;
  outletCount: number;
  reviewedCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### `POST /sessions`

Creates a validation session.

Request:

```ts
{
  name: string;
  fileName: string;
  config: SessionConfig;
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
}
```

Server behavior:

- Calculates `outletCount` from `outlets.length`.
- Calculates `reviewedCount` by counting validation objects with truthy `status`.
- Returns `201` and `SessionSummary`.

### `GET /sessions/:id`

Returns full session detail.

Response:

```ts
interface SessionDetail extends SessionSummary {
  config: SessionConfig;
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
}
```

### `PATCH /sessions/:id`

Updates supported session fields.

Currently supported by server:

- `name`
- `validations`
- `config`
- `outlets`

Server behavior:

- Recalculates `reviewedCount` when `validations` is provided.
- Recalculates `outletCount` when `outlets` is provided.
- Returns updated `SessionSummary`.

Note: OpenAPI currently documents `name`, `validations`, and `reviewedCount`, but the server also accepts `config` and `outlets`. Update `openapi.yaml` to match implementation before regenerating clients.

### `DELETE /sessions/:id`

Deletes a session.

Response:

- `204` on success.
- `404` if not found.

---

## 9. State Management and Persistence

**Source file:** `artifacts/outlet-validator/src/store.ts`

State library: Zustand with `persist` middleware.

Persist key: `outlet-validator-session`.

Persisted:

- Uploaded file metadata except workbook.
- Headers and rows.
- Mappings.
- Visible/verification fields.
- Reviewer name.
- Outlets.
- User location.
- Validations.
- Session ID/name.

Not persisted:

- `workbook`, because it is not serializable.
- `currentStep`, because app always boots to Step 0 session picker.

Offline-safe behavior:

- Local validation changes are saved first.
- Backend sync is best-effort.
- If the backend is unavailable, local persisted data remains.

Important implementation detail:

- Opening a session calls `reset()` then repopulates store and sets `currentStep: 7` directly.

---

## 10. Export Specification

**Source file:** `artifacts/outlet-validator/src/lib/excel.ts`

Export format: `.xlsx`

Sheet name: `Validated Outlets`

File name format:

```text
outlet_validation_YYYY-MM-DD.xlsx
```

Each exported row includes:

- All original outlet fields.
- `Validation Status`
- `Validated By`
- `Validated At`
- `Distance From User KM`
- `User Latitude`
- `User Longitude`
- `General Comments`
- For each configured field to verify:
  - `<field> - Validation Status`
  - `<field> - Corrected Value`
  - `<field> - Comment`

Acceptance criteria:

- Export includes every processed outlet.
- Unvalidated fields export as blank strings.
- Dates are human-readable using local browser formatting.

---

## 11. UI / UX Requirements

### Visual identity

- Brand primary red: `#F40009`.
- Font: Inter.
- Component style: Tailwind + Shadcn UI.
- Mobile-first layout.

### Layout requirements

- Use `h-[100dvh]` to support mobile browser viewport behavior.
- Keep Step 7 as a full-height map/list shell.
- Use `flex-1 min-h-0` parent chains around scrollable content.
- Inputs and buttons must be touch-safe.
- File upload should use label/input pattern for mobile Safari compatibility.

### Navigation requirements

- Step 0 is a full-screen landing/session picker without wizard progress header.
- Steps 1–7 use `StepProgress` header.
- StepProgress shows:
  - app/session name,
  - back-to-sessions action,
  - wizard step indicators.
- Going back to sessions from Step 7 resets to Step 0.
- Starting over before Step 7 requires double-tap confirmation.

---

## 12. Technical Constraints and Guardrails

### OpenAPI / Orval

- `lib/api-spec/openapi.yaml` is the intended contract source of truth.
- Do not edit generated files under `lib/api-zod/src/generated` or `lib/api-client-react/src/generated` manually.
- Keep Orval Zod output `mode: "single"`; changing to `split` can create duplicate exports such as `CreateSessionBody` and `UpdateSessionBody`.

### Leaflet / Vite

At module scope, preserve the Leaflet icon fix:

```ts
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
```

### API payload limits

- Express JSON and URL-encoded body limits are currently set to `50mb`.
- Large Excel imports are stored as JSONB in PostgreSQL; this is simple but may not scale for very large datasets.

### Auth

- There is no auth by design in the current implementation.
- Treat the app as suitable only for private/internal deployment unless auth is added.

---

## 13. Known Gaps / Risks to Address

1. **OpenAPI mismatch:** `PATCH /sessions/:id` server accepts `config` and `outlets`, but `openapi.yaml` only documents `name`, `validations`, and `reviewedCount`. Update spec and regenerate clients.
2. **Generated React Query client is not used by frontend:** frontend currently uses handwritten `sessionsApi` in `src/lib/api.ts`. Decide whether to keep handwritten API or migrate to generated hooks for consistency.
3. **Local/remote conflict risk:** validations are stored locally and synced by overwriting the whole validations object. Concurrent users can overwrite each other’s changes.
4. **Duplicate IDs risk:** duplicate outlet IDs are allowed but validations are keyed by `outlet.id`; duplicates can collide and overwrite validation state. Recommended fix: use a stable unique key such as `${id}__row_${rowIndex}` internally while preserving source ID separately.
5. **Offline sync is best-effort only:** failed sync is silently ignored in Step 8; there is no retry queue or visible unsynced indicator.
6. **No authentication:** anyone with the URL can view, edit, rename, or delete sessions.
7. **No delete confirmation:** session delete appears immediate in UI. Add confirmation for production use.
8. **Large dataset performance:** all outlets and validations are held client-side and in a single JSONB row. Consider pagination or normalized tables if datasets grow.
9. **5 km radius is hard-coded:** expose as configurable if field teams need different coverage.
10. **Distance stored in export depends on latest user location:** distance is computed client-side and not persisted per review event.
11. **Review overlay title uses outlet ID, not display field:** consider showing display name with ID secondary for usability.
12. **Server has no global error handler visible in inspected files:** add structured error middleware for unexpected exceptions.
13. **No test suite observed:** add unit/integration tests around file parsing, mapping, coordinate filtering, API routes, and export.

---

## 14. Recommended Implementation Backlog

### Priority 0 — Stabilize current product

1. Update `openapi.yaml` to document `config` and `outlets` on `PATCH /sessions/:id`.
2. Regenerate API client/Zod schemas.
3. Fix duplicate outlet validation key risk.
4. Add session delete confirmation.
5. Add visible sync state:
   - saved locally,
   - syncing,
   - synced,
   - sync failed.
6. Add retry-on-reconnect for failed validation syncs.

### Priority 1 — Production readiness

1. Add authentication or deployment-level access protection.
2. Add basic authorization for destructive actions.
3. Add backend error middleware.
4. Add request size/user-friendly payload error handling.
5. Add database migration workflow for production.
6. Add tests and CI typecheck/build gate.

### Priority 2 — Field usability improvements

1. Make radius configurable.
2. Add “show all outlets” override when no nearby outlets appear.
3. Add progress summary on map view:
   - reviewed count,
   - unreviewed count,
   - invalid/needs update count.
4. Add status filters for all status values, not only reviewed/unreviewed.
5. Show display name in review overlay header.
6. Persist last active tab/filter per session.

### Priority 3 — Data model scaling

1. Normalize sessions, outlets, and validations into separate tables.
2. Add per-outlet validation update endpoint.
3. Add audit trail with reviewer, timestamp, old value, new value.
4. Add optimistic concurrency or revision IDs.

---

## 15. Acceptance Test Scenarios

### Session lifecycle

1. Start with empty database.
2. Open app.
3. Verify empty session picker state.
4. Start new session.
5. Upload file, configure fields, create session.
6. Return to session picker.
7. Verify session appears with outlet count.
8. Rename session.
9. Open session.
10. Delete session.
11. Verify it no longer appears.

### Upload and mapping

1. Upload `.xlsx` with ID, lat, lng aliases.
2. Verify auto-detection.
3. Continue to manual mapping.
4. Change mappings.
5. Verify valid coordinate count changes.
6. Confirm invalid coordinate rows are excluded.

### Field review

1. Select visible fields.
2. Select subset as fields to verify.
3. Enter reviewer name.
4. Open nearby outlet.
5. Set outlet status to `Needs Update`.
6. Mark one field `Invalid`.
7. Enter corrected value and comment.
8. Save.
9. Reopen same outlet.
10. Verify previous values are loaded.

### Map/list behavior

1. Allow browser location.
2. Verify list shows only outlets within 5 km.
3. Search by outlet ID.
4. Search by display field.
5. Filter reviewed/unreviewed.
6. Switch to map.
7. Verify markers match filtered outlets.
8. Verify configured colors/shapes and legend.

### Offline behavior

1. Create/open a session.
2. Disconnect backend.
3. Save an outlet validation.
4. Verify UI does not lose data.
5. Refresh browser.
6. Verify persisted local validation remains.
7. Reconnect backend.
8. Trigger save/sync and verify backend reflects latest validation.

### Export

1. Complete at least one outlet validation with field correction.
2. Click export.
3. Open resulting workbook.
4. Verify original fields and validation metadata columns exist.
5. Verify validated outlet row contains status, reviewer, timestamp, comments, corrected value.

---

## 16. Coding Agent Instructions

When continuing this project:

1. Preserve the existing mobile-first flow and step numbering.
2. Do not change generated API/Zod files manually.
3. Update `openapi.yaml` first for contract changes, then regenerate clients/schemas.
4. Keep local-first save behavior; do not block field reviewers on network calls.
5. Avoid adding auth unless explicitly requested, but flag the no-auth risk for deployment.
6. Be careful with validation keys if source outlet IDs are duplicated.
7. Keep file input mobile-safe.
8. Keep Leaflet icon fix in place.
9. Run `pnpm run typecheck` and `pnpm run build` after changes.
10. Prefer small targeted changes over broad refactors.

---

## 17. Definition of Done for Next Coding Pass

A coding pass should be considered complete only when:

- The app builds successfully.
- Typecheck passes across workspace.
- Session creation/open/rename/delete works.
- File upload and sheet selection work on desktop and mobile browsers.
- Required mapping validation works.
- At least one validation can be saved locally and synced to DB.
- Exported Excel contains expected validation columns.
- Known contract mismatch between OpenAPI and server is resolved or explicitly deferred.
- Any deferred risks are documented in the handoff notes.

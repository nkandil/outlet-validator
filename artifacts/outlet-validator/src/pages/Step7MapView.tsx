import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { AlertTriangle, Download, LocateFixed, MapPin, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { canManageSessions, useAuth } from "../auth";
import { MapLegend } from "../components/MapLegend";
import { Alert, Badge, Button, Input, Panel, Select, Sheet, TabButton, Tabs } from "../components/ui";
import { sessionsApi } from "../lib/api";
import { exportValidatedWorkbook } from "../lib/excel";
import { nearbySorted } from "../lib/geo";
import { getGoogleMapsUrl, getMapOutlets } from "../lib/map-view";
import { makeOutletIcon, markerColor, markerShape } from "../lib/pins";
import { enqueueValidationSync, getPendingValidationSyncItems, retryValidationSync } from "../lib/sync-queue";
import { asString } from "../lib/utils";
import { useOutletStore } from "../store";
import type { Outlet, OutletValidation } from "../types";
import { Step8OutletReview } from "./Step8OutletReview";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

type Filter = "all" | "reviewed" | "unreviewed";
type OutletLimit = 25 | 50 | 100 | 200 | "all";
const outletLimitOptions: OutletLimit[] = [25, 50, 100, 200, "all"];
const statusFilters: Filter[] = ["all", "unreviewed", "reviewed"];

export function Step7MapView() {
  const sessionId = useOutletStore((state) => state.sessionId);
  const outlets = useOutletStore((state) => state.outlets);
  const radiusKm = useOutletStore((state) => state.radiusKm);
  const validations = useOutletStore((state) => state.validations);
  const confirmedMapping = useOutletStore((state) => state.confirmedMapping);
  const visibleFields = useOutletStore((state) => state.visibleFields);
  const fieldsToVerify = useOutletStore((state) => state.fieldsToVerify);
  const userLocation = useOutletStore((state) => state.userLocation);
  const selectedOutletKey = useOutletStore((state) => state.selectedOutletKey);
  const syncState = useOutletStore((state) => state.syncState);
  const pendingSync = useOutletStore((state) => state.pendingSync);
  const setSyncState = useOutletStore((state) => state.setSyncState);
  const setRadiusKm = useOutletStore((state) => state.setRadiusKm);
  const setUserLocation = useOutletStore((state) => state.setUserLocation);
  const selectOutlet = useOutletStore((state) => state.selectOutlet);

  const [tab, setTab] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<Filter>("unreviewed");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationWatching, setLocationWatching] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [radiusDraft, setRadiusDraft] = useState(String(radiusKm));
  const [outletLimit, setOutletLimit] = useState<OutletLimit>(50);
  const { user } = useAuth();
  const canManage = canManageSessions(user);
  const watchIdRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedRadiusRef = useRef(radiusKm);

  async function refreshPendingSyncCount() {
    setPendingSyncCount((await getPendingValidationSyncItems()).length);
  }

  async function retryPendingSync() {
    setSyncState("syncing");
    try {
      await retryValidationSync((item) => sessionsApi.upsertValidation(item.sessionId, item.outletKey, item.payload).then(() => undefined));
      await refreshPendingSyncCount();
      setSyncState((await getPendingValidationSyncItems()).length ? "failed" : "synced");
    } catch (err) {
      setSyncState("failed", err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function syncValidation(outletKey: string, validation: OutletValidation) {
    if (!sessionId) {
      setSyncState("failed", "No backend session is available yet.");
      return;
    }
    await enqueueValidationSync({ sessionId, outletKey, payload: validation });
    await refreshPendingSyncCount();
    await retryPendingSync();
  }

  function updatePosition(position: GeolocationPosition) {
    setUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      capturedAt: new Date(position.timestamp || Date.now()).toISOString()
    });
    setLocationError("");
    setLocationWatching(true);
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("GPS is not available in this browser.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      () => {
        setLocationWatching(false);
        setLocationError("Location permission denied or unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  }

  useEffect(() => {
    requestLocation();
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // Start one live watch on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function retry() {
      void retryPendingSync();
    }

    window.addEventListener("online", retry);
    void refreshPendingSyncCount();
    if (navigator.onLine) void retryPendingSync();
    return () => window.removeEventListener("online", retry);
    // Retry when pending status changes; do not depend on the whole Zustand state object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSync]);

  useEffect(() => {
    const nextRadius = Number(radiusDraft);
    if (!sessionId || !canManage || !Number.isFinite(nextRadius) || nextRadius <= 0 || nextRadius === lastSavedRadiusRef.current) return;
    const timeout = window.setTimeout(() => {
      setSyncState("saving");
      sessionsApi
        .update(sessionId, { radiusKm: nextRadius })
        .then(() => {
          lastSavedRadiusRef.current = nextRadius;
          setSyncState("synced");
        })
        .catch((err) => setSyncState("failed", err instanceof Error ? err.message : "Sync failed"));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [canManage, radiusDraft, sessionId, setSyncState]);

  const nearby = useMemo(() => nearbySorted(outlets, userLocation, radiusKm), [outlets, radiusKm, userLocation]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nearby.filter((outlet) => {
      const validation = validations[outlet.outletKey];
      if (filter === "reviewed" && !validation?.status) return false;
      if (filter === "unreviewed" && validation?.status) return false;
      if (!q) return true;

      const searchValues = [outlet.id, confirmedMapping.displayField ? outlet.originalData[confirmedMapping.displayField] : "", ...visibleFields.map((field) => outlet.originalData[field])];
      return searchValues.some((value) => asString(value).toLowerCase().includes(q));
    });
  }, [confirmedMapping.displayField, filter, nearby, query, validations, visibleFields]);

  const limitedOutlets = useMemo(() => (outletLimit === "all" ? filtered : filtered.slice(0, outletLimit)), [filtered, outletLimit]);
  const mapOutlets = useMemo(() => getMapOutlets(limitedOutlets, outletLimit), [limitedOutlets, outletLimit]);
  const selectedOutlet = selectedOutletKey ? nearby.find((outlet) => outlet.outletKey === selectedOutletKey) : null;
  const nextOutletKey = useMemo(() => {
    if (!selectedOutletKey) return null;
    const selectedIndex = limitedOutlets.findIndex((outlet) => outlet.outletKey === selectedOutletKey);
    const ordered = selectedIndex >= 0 ? [...limitedOutlets.slice(selectedIndex + 1), ...limitedOutlets.slice(0, selectedIndex)] : limitedOutlets;
    return ordered.find((outlet) => !validations[outlet.outletKey]?.status)?.outletKey ?? null;
  }, [limitedOutlets, selectedOutletKey, validations]);
  const reviewedCount = Object.values(validations).filter((validation) => validation.status).length;
  const center: [number, number] = userLocation ? [userLocation.latitude, userLocation.longitude] : filtered[0] ? [filtered[0].latitude, filtered[0].longitude] : [30.0444, 31.2357];

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function setManualLocation() {
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setUserLocation({ latitude, longitude });
      setLocationError("");
      setSettingsOpen(false);
    }
  }

  function exportData() {
    exportValidatedWorkbook({
      outlets: nearby,
      validations,
      fieldsToVerify,
      userLocation
    });
  }

  function updateRadius(value: string) {
    setRadiusDraft(value);
    const nextRadius = Number(value);
    if (Number.isFinite(nextRadius) && nextRadius > 0) setRadiusKm(nextRadius);
  }

  function toggleSearch() {
    setSearchOpen((open) => {
      if (open) setQuery("");
      return !open;
    });
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{reviewedCount} reviewed</Badge>
            <Badge>{Math.max(outlets.length - reviewedCount, 0)} unreviewed</Badge>
            <Badge>{radiusKm} km radius</Badge>
            {pendingSyncCount ? <Badge tone="warning">{pendingSyncCount} pending</Badge> : null}
            <Badge tone={syncState === "failed" ? "warning" : syncState === "synced" ? "success" : "neutral"}>{syncState.replace("-", " ")}</Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
          <Tabs className="w-full justify-between sm:w-auto">
            {(["list", "map"] as const).map((item) => (
              <TabButton key={item} active={tab === item} className="flex-1 capitalize sm:flex-none" onClick={() => setTab(item)}>
                {item}
              </TabButton>
            ))}
          </Tabs>
          <div className="flex gap-2">
            <Button variant={locationError ? "outline" : "secondary"} className="relative min-h-10 w-10 px-0" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal size={18} />
              {locationError ? <AlertTriangle className="absolute -right-1 -top-1 text-amber-600" size={14} aria-hidden="true" /> : null}
            </Button>
            <Button variant={searchOpen ? "outline" : "secondary"} className="min-h-10 w-10 px-0" aria-label={searchOpen ? "Hide search" : "Search"} onClick={toggleSearch}>
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </Button>
          </div>
          </div>
          {searchOpen ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" size={18} />
              <Input ref={searchInputRef} className="pl-10 pr-10" placeholder="Search ID, display, or visible fields" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query ? (
                <button className="absolute right-2 top-1.5 inline-flex min-h-7 min-w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              ) : null}
            </label>
          ) : null}
        </div>

        {tab === "list" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-2 pb-4">
              {limitedOutlets.length ? limitedOutlets.map((outlet) => <OutletCard key={outlet.outletKey} outlet={outlet} />) : <Panel>No nearby outlets match the current filters.</Panel>}
            </div>
          </div>
        ) : (
          <div className="relative min-h-80 flex-1 overflow-hidden rounded-lg border bg-card">
            <MapContainer center={center} zoom={14} className="h-full w-full">
              <MapCenterUpdater center={center} />
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {userLocation ? (
                <Marker position={[userLocation.latitude, userLocation.longitude]} title="Your location">
                  <Popup>Your location</Popup>
                </Marker>
              ) : null}
              {mapOutlets.map((outlet) => {
                const validation = validations[outlet.outletKey];
                return (
                  <Marker
                    key={outlet.outletKey}
                    position={[outlet.latitude, outlet.longitude]}
                    icon={makeOutletIcon(markerColor(outlet, confirmedMapping, validation), markerShape(outlet, confirmedMapping))}
                    title={displayName(outlet, confirmedMapping.displayField) || outlet.id}
                  >
                    <Popup>
                      <div className="grid min-w-44 gap-2">
                        <strong>{displayName(outlet, confirmedMapping.displayField) || outlet.id}</strong>
                        <span>{outlet.distanceKm !== null ? `${outlet.distanceKm.toFixed(2)} km away` : "Distance unavailable"}</span>
                        {visibleFields.length ? (
                          <div className="grid gap-1 border-t border-slate-200 pt-2 text-xs text-slate-700">
                            {visibleFields.map((field) => (
                              <div key={field} className="break-words">
                                <span className="font-semibold">{field}: </span>
                                {asString(outlet.originalData[field]) || "-"}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <button className="rounded bg-red-600 px-3 py-2 font-semibold text-white" onClick={() => selectOutlet(outlet.outletKey)}>
                          Review
                        </button>
                        <a className="inline-flex min-h-9 items-center justify-center gap-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" href={getGoogleMapsUrl(outlet)} target="_blank" rel="noreferrer">
                          <MapPin size={16} />
                          Google Maps
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            <MapLegend outlets={mapOutlets} validations={validations} mapping={confirmedMapping} />
          </div>
        )}
        {filtered.length > limitedOutlets.length ? <div className="text-xs text-muted-foreground">Showing the nearest {limitedOutlets.length} of {filtered.length} matching outlets.</div> : null}
      </div>

      <Sheet open={settingsOpen} className="p-4 sm:max-w-lg">
        <div className="grid gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Field settings</h2>
              <p className="text-sm text-muted-foreground">Adjust location, export, sync, and outlet range controls.</p>
            </div>
            <Button variant="ghost" className="min-h-9 px-2" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
              <X size={18} />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {canManage ? (
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Nearby radius
                <Input aria-label="Nearby radius" type="number" min={0.1} step={0.1} value={radiusDraft} onChange={(event) => updateRadius(event.target.value)} />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Show nearest
              <Select aria-label="Show nearest" value={String(outletLimit)} onChange={(event) => setOutletLimit(event.target.value === "all" ? "all" : (Number(event.target.value) as OutletLimit))}>
                {outletLimitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All outlets" : `Nearest ${option}`}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div aria-label="Review status" className="grid gap-2">
            <div className="text-sm font-medium text-foreground">Review status</div>
            <Tabs className="w-full">
              {statusFilters.map((item) => (
                <TabButton key={item} active={filter === item} className="flex-1" onClick={() => setFilter(item)}>
                  {filterLabel(item)}
                </TabButton>
              ))}
            </Tabs>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="secondary" onClick={requestLocation}>
              <LocateFixed size={18} />
              {locationWatching ? "Live Location" : "Location"}
            </Button>
            <Button variant="secondary" onClick={exportData}>
              <Download size={18} />
              Export
            </Button>
            <Button variant="secondary" disabled={!pendingSyncCount && syncState !== "failed"} onClick={retryPendingSync}>
              <RefreshCw size={18} />
              Retry Sync
            </Button>
          </div>
          {locationError ? <Alert tone="warning">{locationError}</Alert> : null}
          <div className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Manual location</h3>
              <p className="text-xs text-muted-foreground">Use coordinates when GPS permission is denied or unavailable.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Latitude" value={manualLat} onChange={(event) => setManualLat(event.target.value)} />
              <Input placeholder="Longitude" value={manualLng} onChange={(event) => setManualLng(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={setManualLocation}>Use</Button>
            </div>
          </div>
        </div>
      </Sheet>

      {selectedOutlet ? <Step8OutletReview outlet={selectedOutlet} onSync={syncValidation} nextOutletKey={nextOutletKey} /> : null}
    </main>
  );
}

function displayName(outlet: Outlet, field: string) {
  return field ? asString(outlet.originalData[field]) : "";
}

function filterLabel(filter: Filter) {
  if (filter === "all") return "All";
  if (filter === "unreviewed") return "Unreviewed";
  return "Reviewed";
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function OutletCard({ outlet }: { outlet: Outlet }) {
  const validations = useOutletStore((state) => state.validations);
  const confirmedMapping = useOutletStore((state) => state.confirmedMapping);
  const visibleFields = useOutletStore((state) => state.visibleFields);
  const selectOutlet = useOutletStore((state) => state.selectOutlet);
  const validation = validations[outlet.outletKey];
  const title = displayName(outlet, confirmedMapping.displayField) || outlet.id;
  const status = normalizeLegacyOutletStatus(validation?.status);

  function openReview() {
    selectOutlet(outlet.outletKey);
  }

  function stopCardAction(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
  }

  return (
    <article className="rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/50 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-foreground sm:text-lg">{title}</div>
          <div className="text-sm text-muted-foreground">
            ID {outlet.id}
            {outlet.distanceKm !== null ? ` - ${outlet.distanceKm.toFixed(2)} km` : ""}
          </div>
        </div>
        <Badge tone={status ? "success" : "neutral"}>{status || "Unreviewed"}</Badge>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {visibleFields.slice(0, 4).map((field) => (
          <div key={field} className="truncate">
            <span className="font-medium text-foreground">{field}: </span>
            {asString(outlet.originalData[field]) || "-"}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button onClick={openReview}>Review</Button>
        <a
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={getGoogleMapsUrl(outlet)}
          target="_blank"
          rel="noreferrer"
          onClick={stopCardAction}
        >
          <MapPin size={18} />
          <span className="sr-only sm:not-sr-only">Google Maps</span>
        </a>
      </div>
    </article>
  );
}

function normalizeLegacyOutletStatus(status: string | undefined) {
  return status === "Invalid Lead" ? "Invalid" : status;
}

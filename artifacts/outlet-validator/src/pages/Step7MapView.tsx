import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Download, LocateFixed, MapPin, RefreshCw, Search } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { canManageSessions, useAuth } from "../auth";
import { MapLegend } from "../components/MapLegend";
import { Badge, Button, Input, Panel, Select } from "../components/ui";
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
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [locationError, setLocationError] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [locationWatching, setLocationWatching] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [radiusDraft, setRadiusDraft] = useState(String(radiusKm));
  const [outletLimit, setOutletLimit] = useState<OutletLimit>(50);
  const { user } = useAuth();
  const canManage = canManageSessions(user);
  const watchIdRef = useRef<number | null>(null);
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
        setLocationError("Location permission denied or unavailable. Enter coordinates manually.");
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
  const reviewedCount = Object.values(validations).filter((validation) => validation.status).length;
  const center: [number, number] = userLocation ? [userLocation.latitude, userLocation.longitude] : filtered[0] ? [filtered[0].latitude, filtered[0].longitude] : [30.0444, 31.2357];

  function setManualLocation() {
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setUserLocation({ latitude, longitude });
      setLocationError("");
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

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{reviewedCount} reviewed</Badge>
            <Badge>{Math.max(outlets.length - reviewedCount, 0)} unreviewed</Badge>
            <Badge>{radiusKm} km radius</Badge>
            {pendingSyncCount ? <Badge tone="warning">{pendingSyncCount} pending</Badge> : null}
            <Badge tone={syncState === "failed" ? "warning" : syncState === "synced" ? "success" : "neutral"}>{syncState.replace("-", " ")}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                <span className="sr-only">Nearby radius</span>
                <Input className="w-28" aria-label="Nearby radius" type="number" min={0.1} step={0.1} value={radiusDraft} onChange={(event) => updateRadius(event.target.value)} />
              </label>
            ) : null}
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              <span className="sr-only">Show nearest</span>
              <Select
                aria-label="Show nearest"
                className="w-36"
                value={String(outletLimit)}
                onChange={(event) => setOutletLimit(event.target.value === "all" ? "all" : (Number(event.target.value) as OutletLimit))}
              >
                {outletLimitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All outlets" : `Nearest ${option}`}
                  </option>
                ))}
              </Select>
            </label>
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
        </div>
      </div>

      {locationError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mx-auto grid max-w-6xl gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
            <div className="text-sm font-medium text-amber-900">{locationError}</div>
            <Input placeholder="Latitude" value={manualLat} onChange={(event) => setManualLat(event.target.value)} />
            <Input placeholder="Longitude" value={manualLng} onChange={(event) => setManualLng(event.target.value)} />
            <Button variant="secondary" onClick={setManualLocation}>
              Use
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
          <div className="flex rounded-md border border-slate-200 bg-white p-1">
            {(["list", "map"] as const).map((item) => (
              <button key={item} className={`min-h-10 rounded px-4 text-sm font-semibold capitalize ${tab === item ? "bg-slate-900 text-white" : "text-slate-600"}`} onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-slate-200 bg-white p-1">
            {(["all", "unreviewed", "reviewed"] as Filter[]).map((item) => (
              <button key={item} className={`min-h-10 rounded px-3 text-sm font-semibold capitalize ${filter === item ? "bg-coke text-white" : "text-slate-600"}`} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Search ID, display, or visible fields" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        {tab === "list" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-3 pb-4">
              {limitedOutlets.length ? limitedOutlets.map((outlet) => <OutletCard key={outlet.outletKey} outlet={outlet} />) : <Panel>No nearby outlets match the current filters.</Panel>}
            </div>
          </div>
        ) : (
          <>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <MapContainer center={center} zoom={14} className="h-full w-full">
                <MapCenterUpdater center={center} />
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {userLocation ? (
                  <Marker position={[userLocation.latitude, userLocation.longitude]}>
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
                          <a
                            className="inline-flex min-h-9 items-center justify-center gap-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            href={getGoogleMapsUrl(outlet)}
                            target="_blank"
                            rel="noreferrer"
                          >
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
          </>
        )}
        {filtered.length > limitedOutlets.length ? <div className="text-xs text-slate-500">Showing the nearest {limitedOutlets.length} of {filtered.length} matching outlets.</div> : null}
      </div>

      {selectedOutlet ? <Step8OutletReview outlet={selectedOutlet} onSync={syncValidation} /> : null}
    </main>
  );
}

function displayName(outlet: Outlet, field: string) {
  return field ? asString(outlet.originalData[field]) : "";
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
    <article className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-coke">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-950">{title}</div>
          <div className="text-sm text-slate-500">
            ID {outlet.id}
            {outlet.distanceKm !== null ? ` · ${outlet.distanceKm.toFixed(2)} km` : ""}
          </div>
        </div>
        <Badge tone={status ? "success" : "neutral"}>{status || "Unreviewed"}</Badge>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        {visibleFields.slice(0, 6).map((field) => (
          <div key={field} className="truncate">
            <span className="font-medium">{field}: </span>
            {asString(outlet.originalData[field]) || "-"}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={openReview}>Review</Button>
        <a
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-coke focus:ring-offset-2"
          href={getGoogleMapsUrl(outlet)}
          target="_blank"
          rel="noreferrer"
          onClick={stopCardAction}
        >
          <MapPin size={18} />
          Google Maps
        </a>
      </div>
    </article>
  );
}

function normalizeLegacyOutletStatus(status: string | undefined) {
  return status === "Invalid Lead" ? "Invalid" : status;
}

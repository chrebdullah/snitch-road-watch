import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

type TimeFilter = "today" | "week" | "month" | "all";
const STOCKHOLM_TIMEZONE = "Europe/Stockholm";

type HeatmapReportRow = {
  id?: string;
  created_at?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
  [key: string]: unknown;
};

type HeatmapDebug = {
  activePeriod: TimeFilter;
  fetchedRows: number;
  rowsInSelectedPeriod: number;
  rowsWithValidCoordinates: number;
  renderedHeatPoints: number;
  first3RawRows: HeatmapReportRow[];
  first3TransformedHeatPoints: Array<{ lat: number; lng: number }>;
  coordinateSourceInRuntime: string[];
  dataSource: string;
  timeField: string;
};

const stockholmDayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getStockholmDayKey(value: Date): string {
  return stockholmDayFormatter.format(value);
}

function isRowInSelectedPeriod(createdAt: string, period: TimeFilter): boolean {
  const rowDate = new Date(createdAt);
  if (Number.isNaN(rowDate.getTime())) return false;

  if (period === "all") return true;

  if (period === "today") {
    return getStockholmDayKey(rowDate) === getStockholmDayKey(new Date());
  }

  const nowMs = Date.now();
  const days = period === "week" ? 7 : 30;
  return rowDate.getTime() >= nowMs - days * 86400000;
}

function mapRowsToPoints(rows: HeatmapReportRow[]): {
  points: [number, number][];
  validCoordinateReports: number;
  coordinateSourceInRuntime: string[];
} {
  const points: [number, number][] = [];
  let validCoordinateReports = 0;
  const coordinateSourceInRuntime = new Set<string>();

  for (const row of rows) {
    const hasLatitudeLongitude =
      toFiniteNumber(row.latitude) !== null && toFiniteNumber(row.longitude) !== null;
    const hasLatLng = toFiniteNumber(row.lat) !== null && toFiniteNumber(row.lng) !== null;
    const lat = toFiniteNumber(row.latitude ?? row.lat);
    const lng = toFiniteNumber(row.longitude ?? row.lng);

    if (lat === null || lng === null) continue;

    points.push([lat, lng]);
    validCoordinateReports += 1;
    if (hasLatitudeLongitude) coordinateSourceInRuntime.add("latitude/longitude");
    if (hasLatLng) coordinateSourceInRuntime.add("lat/lng");
  }

  return {
    points,
    validCoordinateReports,
    coordinateSourceInRuntime: Array.from(coordinateSourceInRuntime),
  };
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 20,
      maxZoom: 12,
      minOpacity: 0.3,
      gradient: { 0.2: "#00ff00", 0.5: "#FFE600", 0.8: "#ff6600", 1.0: "#ff0000" },
    });
    heat.addTo(map);
    layerRef.current = heat;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [points, map]);

  return null;
}

function UserLocation() {
  const map = useMap();
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 10),
      () => {} // keep default
    );
  }, [map]);
  return null;
}

export default function MapSection() {
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<TimeFilter>("all");
  const [livePoints, setLivePoints] = useState<[number, number][]>([]);
  const [debug, setDebug] = useState<HeatmapDebug>({
    activePeriod: "all",
    fetchedRows: 0,
    rowsInSelectedPeriod: 0,
    rowsWithValidCoordinates: 0,
    renderedHeatPoints: 0,
    first3RawRows: [],
    first3TransformedHeatPoints: [],
    coordinateSourceInRuntime: [],
    dataSource: "public.reports",
    timeField: "created_at",
  });
  const filterRef = useRef<TimeFilter>(filter);
  const latestRequestRef = useRef(0);

  const fetchHeatmapData = useCallback(async (period: TimeFilter, reason: "filter-change" | "realtime-insert") => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    let response: Response;
    try {
      const endpoint = new URL("/.netlify/functions/heatmap-reports", window.location.origin).toString();
      response = await fetch(endpoint, { method: "GET" });
    } catch (error) {
      console.error("[Heatmap] Failed to reach heatmap endpoint", {
        reason,
        period,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }

    const payload = await response.json() as {
      rows?: HeatmapReportRow[];
      data_source?: string;
      time_field?: string;
      error?: string;
    };

    if (!response.ok) {
      console.error("[Heatmap] Endpoint error", {
        period,
        reason,
        error: payload?.error || `HTTP ${response.status}`,
      });
      return;
    }

    const fetchedRows = Array.isArray(payload.rows) ? payload.rows : [];
    const rowsInSelectedPeriod = fetchedRows.filter((row) => {
      if (!row.created_at || typeof row.created_at !== "string") return false;
      return isRowInSelectedPeriod(row.created_at, period);
    });
    const mapped = mapRowsToPoints(rowsInSelectedPeriod);
    const transformed = mapped.points.slice(0, 3).map(([lat, lng]) => ({ lat, lng }));

    if (requestId !== latestRequestRef.current) {
      console.info("[Heatmap] Ignored stale response", { period, requestId });
      return;
    }

    setCount(mapped.points.length);
    setLivePoints(mapped.points);
    setDebug({
      activePeriod: period,
      fetchedRows: fetchedRows.length,
      rowsInSelectedPeriod: rowsInSelectedPeriod.length,
      rowsWithValidCoordinates: mapped.validCoordinateReports,
      renderedHeatPoints: mapped.points.length,
      first3RawRows: rowsInSelectedPeriod.slice(0, 3),
      first3TransformedHeatPoints: transformed,
      coordinateSourceInRuntime: mapped.coordinateSourceInRuntime,
      dataSource: payload.data_source || "public.reports",
      timeField: payload.time_field || "created_at",
    });

    console.info("[Heatmap Debug]", {
      "active period": period,
      "fetched rows": fetchedRows.length,
      "rows in selected period": rowsInSelectedPeriod.length,
      "rows with valid coordinates": mapped.validCoordinateReports,
      "rendered heat points": mapped.points.length,
      "first 3 raw rows": rowsInSelectedPeriod.slice(0, 3),
      "first 3 transformed heat points": transformed,
      "time filter for Idag": `created_at in ${STOCKHOLM_TIMEZONE}`,
      "coordinate fields seen at runtime": mapped.coordinateSourceInRuntime,
      reason,
    });
  }, []);

  useEffect(() => {
    filterRef.current = filter;
    void fetchHeatmapData(filter, "filter-change");
  }, [fetchHeatmapData, filter]);

  useEffect(() => {
    const channel = supabase
      .channel("reports-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
        void fetchHeatmapData(filterRef.current, "realtime-insert");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchHeatmapData]);

  const heatPoints: [number, number, number][] = useMemo(() => {
    return livePoints.map(([lat, lng]) => [lat, lng, 0.6]);
  }, [livePoints]);

  const filters: { key: TimeFilter; label: string }[] = [
    { key: "today", label: "Idag" },
    { key: "week", label: "Veckan" },
    { key: "month", label: "Månaden" },
    { key: "all", label: "Alla" },
  ];

  return (
    <section id="map" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary text-xs text-muted-foreground font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            Live – {count} rapporterade incidenter
          </div>
          <h2 className="text-4xl sm:text-5xl font-display font-black text-foreground">
            Incidenter i Sverige
          </h2>
          <p className="mt-3 text-muted-foreground text-base max-w-md mx-auto">
            Heatmap baserad på rapporterade händelser. Rött = hög koncentration.
          </p>
        </div>

        {/* Time filters */}
        <div className="flex justify-center gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium min-h-[48px] transition-all ${
                filter === f.key
                  ? "bg-accent-brand text-accent-brand-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border overflow-hidden" style={{ height: 520 }}>
          <MapContainer
            center={[62.5, 17.0]}
            zoom={4}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
            attributionControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <HeatmapLayer points={heatPoints} />
            <UserLocation />
          </MapContainer>
        </div>

        <div className="mt-0 rounded-b-2xl border border-t-0 border-border px-6 py-4 flex flex-wrap gap-6 justify-between items-center bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Hög
            <span className="w-2 h-2 rounded-full bg-accent-brand inline-block ml-2" /> Medel
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block ml-2" /> Låg
          </div>
          <div className="text-sm text-muted-foreground">
            Ingen personlig data visas
          </div>
        </div>

        <div className="rounded-b-2xl border border-t-0 border-border px-6 py-4 bg-card">
          <p className="text-xs text-muted-foreground mb-2">Heatmap debug</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>active period: {debug.activePeriod}</p>
            <p>fetched rows: {debug.fetchedRows}</p>
            <p>rows in selected period: {debug.rowsInSelectedPeriod}</p>
            <p>rows with valid coordinates: {debug.rowsWithValidCoordinates}</p>
            <p>rendered heat points: {debug.renderedHeatPoints}</p>
            <p>time field: {debug.timeField} ({STOCKHOLM_TIMEZONE} for Idag)</p>
            <p>data source: {debug.dataSource}</p>
            <p>coordinate fields in runtime: {debug.coordinateSourceInRuntime.join(", ") || "none"}</p>
          </div>
          <pre className="mt-3 text-[11px] text-muted-foreground/90 overflow-x-auto whitespace-pre-wrap">
            {`first 3 raw rows:\n${JSON.stringify(debug.first3RawRows, null, 2)}\n\nfirst 3 transformed heat points:\n${JSON.stringify(debug.first3TransformedHeatPoints, null, 2)}`}
          </pre>
        </div>
      </div>
    </section>
  );
}

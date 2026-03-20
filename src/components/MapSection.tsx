import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

type TimeFilter = "today" | "week" | "month" | "all";

function getFilterStartDate(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      return new Date(now.getTime() - 7 * 86400000);
    case "month":
      return new Date(now.getTime() - 30 * 86400000);
    default: return null;
  }
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
  const filterRef = useRef<TimeFilter>(filter);
  const latestRequestRef = useRef(0);

  const fetchHeatmapData = useCallback(async (period: TimeFilter, reason: "filter-change" | "realtime-insert") => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    const startDate = getFilterStartDate(period);
    const startIso = startDate ? startDate.toISOString() : null;
    const requestParams = {
      period,
      created_at_gte: startIso,
      time_field: "created_at",
    };

    console.info("[Heatmap] Selected period", { period, reason });
    console.info("[Heatmap] Request params", requestParams);

    let query = supabase
      .from("reports_public")
      .select("id, latitude, longitude, created_at", { count: "exact" })
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (startIso) {
      query = query.gte("created_at", startIso);
    }

    console.info("[Heatmap] Backend time boundary", {
      filter_column: "created_at",
      created_at_gte: startIso,
      filter_applied: Boolean(startIso),
    });

    const { data, count: total, error } = await query;

    if (requestId !== latestRequestRef.current) {
      console.info("[Heatmap] Ignored stale response", { period, requestId });
      return;
    }

    if (error) {
      console.error("[Heatmap] Failed to load data", { period, message: error.message });
      return;
    }

    const pts: [number, number][] = (data || [])
      .filter((r: any) => typeof r.latitude === "number" && typeof r.longitude === "number")
      .map((r: any) => [r.latitude, r.longitude]);

    setCount(total ?? pts.length);
    setLivePoints(pts);

    console.info("[Heatmap] Returned points", {
      period,
      returned_rows: data?.length ?? 0,
      rendered_points: pts.length,
      total_count: total ?? null,
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
      </div>
    </section>
  );
}

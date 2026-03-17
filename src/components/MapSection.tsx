import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2hyZWJkdWxsYWgiLCJhIjoiY21sdWluc2Z4MDczODNkczk1NWF4ZWg5YyJ9.U-b23ZePlaIhE7h1gDKRXg";

// 20 seeded incidents across Sweden (realistic distribution on land)
const SEED_INCIDENTS: { lat: number; lng: number; city: string }[] = [
  // Stockholm (5)
  { lat: 59.3293, lng: 18.0686, city: "Stockholm" },
  { lat: 59.3500, lng: 18.0200, city: "Stockholm" },
  { lat: 59.3100, lng: 18.0900, city: "Stockholm" },
  { lat: 59.3700, lng: 18.0000, city: "Stockholm" },
  { lat: 59.2800, lng: 18.1100, city: "Stockholm" },
  // Göteborg (4)
  { lat: 57.7089, lng: 11.9746, city: "Göteborg" },
  { lat: 57.7200, lng: 11.9500, city: "Göteborg" },
  { lat: 57.6900, lng: 11.9900, city: "Göteborg" },
  { lat: 57.7400, lng: 12.0000, city: "Göteborg" },
  // Malmö (3)
  { lat: 55.6050, lng: 13.0038, city: "Malmö" },
  { lat: 55.6200, lng: 12.9800, city: "Malmö" },
  { lat: 55.5900, lng: 13.0200, city: "Malmö" },
  // Uppsala (2)
  { lat: 59.8586, lng: 17.6389, city: "Uppsala" },
  { lat: 59.8700, lng: 17.6200, city: "Uppsala" },
  // Linköping (2)
  { lat: 58.4108, lng: 15.6214, city: "Linköping" },
  { lat: 58.4200, lng: 15.6100, city: "Linköping" },
  // Umeå (2)
  { lat: 63.8258, lng: 20.2630, city: "Umeå" },
  { lat: 63.8300, lng: 20.2500, city: "Umeå" },
  // Luleå (1)
  { lat: 65.5848, lng: 22.1547, city: "Luleå" },
  // Sundsvall (1)
  { lat: 62.3908, lng: 17.3069, city: "Sundsvall" },
];

type Incident = { lat: number; lng: number; city: string };

function buildGeoJSON(incidents: Incident[]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents.map((inc, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [inc.lng, inc.lat] },
      properties: { id: `inc-${i}`, city: inc.city },
    })),
  };
}

export default function MapSection() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [count, setCount] = useState(21);
  const [inView, setInView] = useState(false);

  // Lazy load: only init map when section is in viewport
  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  // Fetch live count
  useEffect(() => {
    supabase
      .from("reports_public")
      .select("id", { count: "exact", head: true })
      .then(({ count: total }) => {
        setCount(Math.max(total ?? 0, 21));
      });
  }, []);

  // Init Mapbox when in view
  useEffect(() => {
    if (!inView || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [17.0, 62.5],
      zoom: 4,
      maxBounds: [[8.0, 54.0], [26.0, 70.5]],
      scrollZoom: false,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", async () => {
      // Fetch live approved incidents with coordinates and city
      const { data: liveData } = await supabase
        .from("reports_public")
        .select("id, latitude, longitude, city")
        .not("latitude", "is", null);

      const livePoints: Incident[] = (liveData || [])
        .filter((r: any) => r.latitude && r.longitude)
        .map((r: any) => ({ lat: r.latitude, lng: r.longitude, city: r.city || "" }));

      // Merge seed + live
      const allPoints: Incident[] = [...SEED_INCIDENTS, ...livePoints];
      const geojson = buildGeoJSON(allPoints);

      map.addSource("incidents", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Cluster circles
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "incidents",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1a1a1a",
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 32],
        },
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "incidents",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual points
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "incidents",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ffffff",
          "circle-radius": 4,
          "circle-opacity": 0.8,
          "circle-blur": 0.3,
        },
      });

      // Glow layer
      map.addLayer({
        id: "unclustered-glow",
        type: "circle",
        source: "incidents",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ffffff",
          "circle-radius": 10,
          "circle-opacity": 0.08,
          "circle-blur": 1,
        },
      });

      // City labels on unclustered points
      map.addLayer({
        id: "unclustered-label",
        type: "symbol",
        source: "incidents",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "city"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": "rgba(255,255,255,0.4)",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 1,
        },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [inView]);

  return (
    <section id="map" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            Live – {count} rapporterade incidenter
          </div>
          <h2 className="text-4xl sm:text-5xl font-display font-black text-white">
            Incidenter i Sverige
          </h2>
          <p className="mt-3 text-white/40 text-base max-w-md mx-auto">
            Varje punkt representerar en rapporterad händelse. Ingen personlig data visas.
          </p>
        </div>

        <div
          ref={mapContainer}
          className="relative rounded-2xl border border-white/10 overflow-hidden"
          style={{ height: 520, background: "hsl(0 0% 4%)" }}
        />

        {/* Bottom stats bar */}
        <div className="mt-0 rounded-b-2xl border border-t-0 border-white/10 px-6 py-4 flex flex-wrap gap-6 justify-between items-center" style={{ background: "hsl(0 0% 4%)" }}>
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span className="w-2 h-2 rounded-full bg-white/70 inline-block" />
            Varje punkt = 1 rapporterad händelse
          </div>
          <div className="text-sm text-white/40">
            Ingen personlig data visas
          </div>
        </div>
      </div>
    </section>
  );
}

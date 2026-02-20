import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2hyZWJkdWxsYWgiLCJhIjoiY21sdWluc2Z4MDczODNkczk1NWF4ZWg5YyJ9.U-b23ZePlaIhE7h1gDKRXg";

// 115 seeded incidents across Sweden (realistic distribution on land)
const SEED_INCIDENTS: [number, number][] = [
  // Stockholm region (30)
  [59.3293, 18.0686], [59.3500, 18.0200], [59.3100, 18.0900], [59.3700, 18.0000],
  [59.2800, 18.1100], [59.3400, 17.9500], [59.3600, 18.1300], [59.4000, 18.0400],
  [59.2500, 18.0800], [59.3200, 17.9200], [59.4100, 17.9800], [59.3800, 18.0800],
  [59.2900, 18.0300], [59.3100, 18.1500], [59.3550, 18.0100], [59.3650, 17.9700],
  [59.3950, 18.0600], [59.2700, 18.0500], [59.4200, 18.0200], [59.3350, 18.1100],
  [59.3050, 17.9800], [59.3750, 18.1000], [59.2600, 18.0700], [59.3450, 18.0400],
  [59.3900, 17.9600], [59.3150, 18.0100], [59.3850, 18.0300], [59.2750, 18.1200],
  [59.4050, 18.0100], [59.3250, 18.0500],
  // Gothenburg region (20)
  [57.7089, 11.9746], [57.7200, 11.9500], [57.6900, 11.9900], [57.7400, 12.0000],
  [57.6800, 11.9600], [57.7100, 12.0100], [57.7300, 11.9300], [57.6700, 11.9800],
  [57.7500, 11.9700], [57.7000, 11.9400], [57.6950, 12.0200], [57.7150, 11.9100],
  [57.7350, 11.9900], [57.6850, 11.9700], [57.7250, 12.0050], [57.7050, 11.9550],
  [57.6750, 11.9850], [57.7450, 11.9450], [57.6650, 11.9750], [57.7550, 11.9650],
  // Malmö region (15)
  [55.6050, 13.0038], [55.6200, 12.9800], [55.5900, 13.0200], [55.6300, 13.0400],
  [55.5800, 12.9900], [55.6100, 13.0500], [55.6400, 12.9700], [55.5700, 13.0100],
  [55.6150, 13.0300], [55.5950, 12.9600], [55.6350, 13.0100], [55.5850, 13.0400],
  [55.6250, 12.9500], [55.5750, 13.0000], [55.6450, 13.0200],
  // Uppsala (8)
  [59.8586, 17.6389], [59.8700, 17.6200], [59.8500, 17.6500], [59.8800, 17.6100],
  [59.8400, 17.6600], [59.8650, 17.6300], [59.8750, 17.6450], [59.8550, 17.6150],
  // Linköping (6)
  [58.4108, 15.6214], [58.4200, 15.6100], [58.4000, 15.6300], [58.4300, 15.6000],
  [58.4050, 15.6400], [58.4150, 15.6050],
  // Västerås (5)
  [59.6099, 16.5448], [59.6200, 16.5300], [59.6000, 16.5600], [59.6300, 16.5200],
  [59.6150, 16.5500],
  // Örebro (5)
  [59.2753, 15.2134], [59.2800, 15.2000], [59.2700, 15.2300], [59.2900, 15.1900],
  [59.2650, 15.2200],
  // Umeå (5)
  [63.8258, 20.2630], [63.8300, 20.2500], [63.8200, 20.2800], [63.8400, 20.2400],
  [63.8150, 20.2700],
  // Luleå (4)
  [65.5848, 22.1547], [65.5900, 22.1400], [65.5800, 22.1700], [65.5950, 22.1300],
  // Jönköping (4)
  [57.7826, 14.1618], [57.7900, 14.1500], [57.7750, 14.1700], [57.7850, 14.1400],
  // Norrköping (4)
  [58.5942, 16.1826], [58.6000, 16.1700], [58.5880, 16.1900], [58.6050, 16.1600],
  // Sundsvall (3)
  [62.3908, 17.3069], [62.3950, 17.2900], [62.3850, 17.3200],
  // Karlstad (3)
  [59.3793, 13.5036], [59.3850, 13.4900], [59.3750, 13.5200],
  // Gävle (3)
  [60.6749, 17.1413], [60.6800, 17.1300], [60.6700, 17.1500],
];

function buildGeoJSON(incidents: [number, number][]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents.map((coords, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [coords[1], coords[0]] },
      properties: { id: `seed-${i}` },
    })),
  };
}

export default function MapSection() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [count, setCount] = useState(115);
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
      .from("reports")
      .select("id", { count: "exact", head: true })
      .then(({ count: total }) => {
        if (total !== null && total > 0) setCount(total);
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
      // Fetch live approved incidents with coordinates
      const { data: liveData } = await supabase
        .from("reports")
        .select("id, latitude, longitude")
        .eq("approved", true)
        .not("latitude", "is", null);

      const livePoints: [number, number][] = (liveData || [])
        .filter((r) => r.latitude && r.longitude)
        .map((r) => [r.latitude!, r.longitude!]);

      // Merge seed + live (deduplicated by proximity isn't needed, just combine)
      const allPoints = [...SEED_INCIDENTS, ...livePoints];
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

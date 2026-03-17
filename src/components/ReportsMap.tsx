import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { supabase } from "@/integrations/supabase/client";

type PublicReport = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  masked_reg: string | null;
  city: string | null;
  created_at: string | null;
};

type HeatPoint = [number, number, number];

const STOCKHOLM_CENTER: [number, number] = [59.3293, 18.0686];

function HeatmapLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    if (points.length === 0) {
      layerRef.current = null;
      return;
    }

    const heatLayer = L.heatLayer(points, {
      radius: 22,
      blur: 18,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.2: "#38bdf8",
        0.45: "#facc15",
        0.7: "#fb923c",
        1.0: "#ef4444",
      },
    });

    heatLayer.addTo(map);
    layerRef.current = heatLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, points]);

  return null;
}

function formatCreatedAt(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsMap() {
  const [reports, setReports] = useState<PublicReport[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("reports_public")
        .select("id, latitude, longitude, masked_reg, city, created_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Kunde inte hämta godkända rapporter för kartan:", error.message);
        return;
      }

      setReports((data as PublicReport[]) ?? []);
    };

    fetchReports();
  }, []);

  const validPoints = useMemo(
    () =>
      reports
        .filter((report) => report.latitude !== null && report.longitude !== null)
        .map((report) => ({
          id: report.id,
          lat: report.latitude as number,
          lng: report.longitude as number,
          maskedReg: report.masked_reg ?? "Okänd",
          city: report.city ?? "Stockholm",
          createdAt: report.created_at,
        })),
    [reports],
  );

  const heatPoints = useMemo<HeatPoint[]>(
    () => validPoints.map((point) => [point.lat, point.lng, 0.7]),
    [validPoints],
  );

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
      <div className="h-[460px] w-full">
        <MapContainer
          center={STOCKHOLM_CENTER}
          zoom={11}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <HeatmapLayer points={heatPoints} />
          {validPoints.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={6}
              pathOptions={{
                color: "#111827",
                weight: 1,
                fillColor: "#ef4444",
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{point.maskedReg}</div>
                  <div>{point.city}</div>
                  <div className="text-xs text-gray-500">{formatCreatedAt(point.createdAt)}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

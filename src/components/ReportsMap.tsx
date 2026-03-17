import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export type ReportMapItem = {
  id: string;
  latitude: number;
  longitude: number;
  registrationNumber: string;
  address: string;
  time: string | null;
  comment?: string | null;
  photoUrl?: string | null;
};

type HeatPoint = [number, number, number];

type ReportsMapProps = {
  reports: ReportMapItem[];
  selectedReportId?: string | null;
  onSelectReport?: (report: ReportMapItem) => void;
};

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
      radius: 24,
      blur: 22,
      maxZoom: 16,
      minOpacity: 0.4,
      gradient: {
        0.2: "#facc15",
        0.55: "#fb923c",
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

export default function ReportsMap({ reports, selectedReportId, onSelectReport }: ReportsMapProps) {
  const heatPoints = useMemo<HeatPoint[]>(
    () => reports.map((report) => [report.latitude, report.longitude, 0.8]),
    [reports],
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
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <HeatmapLayer points={heatPoints} />
          {reports.map((report) => {
            const isSelected = selectedReportId === report.id;

            return (
              <CircleMarker
                key={report.id}
                center={[report.latitude, report.longitude]}
                radius={isSelected ? 9 : 6}
                pathOptions={{
                  color: isSelected ? "#fde047" : "#f59e0b",
                  weight: isSelected ? 2 : 1,
                  fillColor: "#facc15",
                  fillOpacity: 0.95,
                }}
                eventHandlers={{
                  click: () => onSelectReport?.(report),
                }}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

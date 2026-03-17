import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Popup, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { supabase } from "@/integrations/supabase/client";

type PublicReport = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  masked_reg: string | null;
  address: string | null;
  happened_on: string | null;
  created_at: string | null;
};

type MapReport = {
  id: string;
  lat: number;
  lng: number;
  registrationNumber: string;
  address: string;
  time: string | null;
};

type HeatPoint = [number, number, number];

const STOCKHOLM_CENTER: [number, number] = [59.3293, 18.0686];

const SEEDED_STOCKHOLM_REPORTS: MapReport[] = [
  {
    id: "seed-kld391",
    lat: 59.3145,
    lng: 18.0747,
    registrationNumber: "KL***91",
    address: "Götgatan 44, Södermalm",
    time: new Date(Date.now() - (6 * 24 + 3) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-rpt682",
    lat: 59.3187,
    lng: 18.0602,
    registrationNumber: "RP***82",
    address: "Hornsgatan 122, Södermalm",
    time: new Date(Date.now() - (5 * 24 + 19) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-svx904",
    lat: 59.3141,
    lng: 18.0828,
    registrationNumber: "SV***04",
    address: "Folkungagatan 98, Södermalm",
    time: new Date(Date.now() - (5 * 24 + 2) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-mnb247",
    lat: 59.3355,
    lng: 18.0798,
    registrationNumber: "MN***47",
    address: "Strandvägen 17, Östermalm",
    time: new Date(Date.now() - (4 * 24 + 6) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-qwe518",
    lat: 59.3432,
    lng: 18.0777,
    registrationNumber: "QW***18",
    address: "Karlavägen 63, Östermalm",
    time: new Date(Date.now() - (3 * 24 + 21) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-hjt763",
    lat: 59.3469,
    lng: 18.0474,
    registrationNumber: "HJ***63",
    address: "Odengatan 52, Vasastan",
    time: new Date(Date.now() - (3 * 24 + 1) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-plm140",
    lat: 59.3338,
    lng: 18.0329,
    registrationNumber: "PL***40",
    address: "Sankt Eriksgatan 31, Kungsholmen",
    time: new Date(Date.now() - (2 * 24 + 14) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-cbv329",
    lat: 59.3294,
    lng: 18.0406,
    registrationNumber: "CB***29",
    address: "Hantverkargatan 29, Kungsholmen",
    time: new Date(Date.now() - (1 * 24 + 23) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-ytr856",
    lat: 59.3257,
    lng: 18.07,
    registrationNumber: "YT***56",
    address: "Västerlånggatan 12, Gamla Stan",
    time: new Date(Date.now() - (1 * 24 + 8) * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-dfa275",
    lat: 59.3377,
    lng: 18.0665,
    registrationNumber: "DF***75",
    address: "Birger Jarlsgatan 57, Norrmalm",
    time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

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

function formatCreatedAt(dateString: string | null): string {
  if (!dateString) return "Okänd tid";
  return new Date(dateString).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapReportFromPublic(report: PublicReport): MapReport | null {
  if (report.latitude === null || report.longitude === null) {
    return null;
  }

  return {
    id: report.id,
    lat: report.latitude,
    lng: report.longitude,
    registrationNumber: report.masked_reg ?? "Okänd",
    address: report.address ?? "Adress saknas",
    time: report.happened_on ?? report.created_at,
  };
}

function dedupeReports(reports: MapReport[]): MapReport[] {
  const unique = new Map<string, MapReport>();

  for (const report of reports) {
    const key = `${report.registrationNumber}-${report.lat.toFixed(4)}-${report.lng.toFixed(4)}-${report.address}`;
    if (!unique.has(key)) {
      unique.set(key, report);
    }
  }

  return Array.from(unique.values());
}

export default function ReportsMap() {
  const [reports, setReports] = useState<MapReport[]>(SEEDED_STOCKHOLM_REPORTS);

  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("reports_public")
        .select("id, latitude, longitude, masked_reg, address, happened_on, created_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Kunde inte hämta godkända rapporter för kartan:", error.message);
        return;
      }

      const fetchedReports = ((data as PublicReport[]) ?? [])
        .map(mapReportFromPublic)
        .filter((report): report is MapReport => report !== null);

      const merged = dedupeReports([...fetchedReports, ...SEEDED_STOCKHOLM_REPORTS]);
      setReports(merged);
    };

    fetchReports();
  }, []);

  const heatPoints = useMemo<HeatPoint[]>(
    () => reports.map((report) => [report.lat, report.lng, 0.8]),
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
          {reports.map((report) => (
            <CircleMarker
              key={report.id}
              center={[report.lat, report.lng]}
              radius={6}
              pathOptions={{
                color: "#f59e0b",
                weight: 1,
                fillColor: "#facc15",
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <div><span className="font-semibold">Adress:</span> {report.address}</div>
                  <div><span className="font-semibold">Tid:</span> {formatCreatedAt(report.time)}</div>
                  <div><span className="font-semibold">Registreringsnummer:</span> {report.registrationNumber}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Incident = {
  id: string;
  latitude: number;
  longitude: number;
};

// Sweden bounds: lat 55.2–69.1, lng 10.5–24.2
const MIN_LAT = 55.2, MAX_LAT = 69.1;
const MIN_LNG = 10.5, MAX_LNG = 24.2;
const SVG_W = 340, SVG_H = 600;

function geoToSvg(lat: number, lng: number) {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * SVG_W;
  const y = SVG_H - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * SVG_H;
  return { x, y };
}

// More accurate Sweden outline (simplified but geographically correct)
const SWEDEN_PATH = `
  M 160,18
  L 175,22 L 192,18 L 205,24 L 215,36 L 218,52
  L 225,62 L 228,78 L 222,92 L 230,104 L 238,118
  L 242,136 L 236,152 L 242,165 L 248,182 L 246,200
  L 240,215 L 248,230 L 250,248 L 244,264 L 235,278
  L 228,295 L 232,312 L 228,330 L 218,346 L 208,362
  L 202,380 L 195,396 L 185,412 L 175,425 L 162,438
  L 150,448 L 138,456 L 124,460 L 112,452 L 104,440
  L 96,425 L 90,408 L 88,390 L 94,374 L 102,358
  L 108,342 L 105,324 L 110,306 L 118,290 L 120,272
  L 115,254 L 118,236 L 122,218 L 118,200 L 110,184
  L 108,166 L 114,150 L 118,132 L 116,114 L 122,96
  L 120,78 L 126,62 L 132,48 L 140,36 L 148,26 Z
`;

export default function MapSection() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data, count: total } = await supabase
        .from("reports")
        .select("id, latitude, longitude", { count: "exact" })
        .eq("approved", true)
        .not("latitude", "is", null);
      if (data) setIncidents(data as Incident[]);
      if (total !== null) setCount(total);
    };
    fetchIncidents();

    // Also get total count including unapproved for the live counter
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .then(({ count: total }) => {
        if (total !== null) setCount(total);
      });
  }, []);

  return (
    <section id="map" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            Live – {count || 115} rapporterade incidenter
          </div>
          <h2 className="text-4xl sm:text-5xl font-display font-black text-white">
            Incidenter i Sverige
          </h2>
          <p className="mt-3 text-white/40 text-base max-w-md mx-auto">
            Varje punkt representerar en rapporterad händelse. Ingen personlig data visas.
          </p>
        </div>

        <div
          className="relative rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: "hsl(0 0% 4%)" }}
        >
          <div className="relative flex items-center justify-center py-10 px-4">
            <div className="relative mx-auto" style={{ width: "100%", maxWidth: 320 }}>
              {/* Sweden SVG outline */}
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full opacity-25"
                style={{ filter: "drop-shadow(0 0 24px rgba(255,255,255,0.06))" }}
              >
                <path
                  d={SWEDEN_PATH}
                  fill="rgba(255,255,255,0.04)"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>

              {/* Incident dots */}
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="absolute inset-0 w-full h-full"
              >
                {incidents.map((inc) => {
                  if (!inc.latitude || !inc.longitude) return null;
                  // Clamp to Sweden bounds
                  if (
                    inc.latitude < MIN_LAT || inc.latitude > MAX_LAT ||
                    inc.longitude < MIN_LNG || inc.longitude > MAX_LNG
                  ) return null;
                  const { x, y } = geoToSvg(inc.latitude, inc.longitude);
                  return (
                    <g key={inc.id}>
                      {/* Glow ring */}
                      <circle cx={x} cy={y} r="6" fill="white" opacity="0.06" />
                      {/* Dot */}
                      <circle cx={x} cy={y} r="3" fill="white" opacity="0.75" />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Bottom stats bar */}
          <div className="border-t border-white/5 px-6 py-4 flex flex-wrap gap-6 justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-white/40">
              <span className="w-2 h-2 rounded-full bg-white/70 inline-block" />
              Varje punkt = 1 händelse
            </div>
            <div className="text-sm text-white/40">
              Ingen personlig data visas
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

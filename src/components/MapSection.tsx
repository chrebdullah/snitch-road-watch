import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Incident = {
  id: string;
  latitude: number;
  longitude: number;
  city: string | null;
};

// Sweden bounds: lat 55.3–69.1, lng 10.5–24.2
function geoToSvg(lat: number, lng: number) {
  const minLat = 55.2, maxLat = 69.2;
  const minLng = 10.4, maxLng = 24.3;
  const svgW = 400, svgH = 600;
  const x = ((lng - minLng) / (maxLng - minLng)) * svgW;
  const y = svgH - ((lat - minLat) / (maxLat - minLat)) * svgH;
  return { x, y };
}

export default function MapSection() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [count, setCount] = useState(115);

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data, count: total } = await supabase
        .from("reports")
        .select("id, latitude, longitude, city", { count: "exact" })
        .eq("approved", true)
        .not("latitude", "is", null);
      if (data) setIncidents(data as Incident[]);
      if (total) setCount(total);
    };
    fetchIncidents();
  }, []);

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
            Varje punkt representerar en rapporterad incident. Ingen personlig data visas.
          </p>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-card overflow-hidden" style={{ background: "hsl(0 0% 4%)" }}>
          {/* Map container */}
          <div className="relative flex items-center justify-center py-8 px-4">
            <div className="relative w-full max-w-sm mx-auto">
              {/* Sweden SVG outline */}
              <svg
                viewBox="0 0 400 600"
                className="w-full opacity-20"
                style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,0.05))" }}
              >
                {/* Simplified Sweden outline path */}
                <path
                  d="M220,30 L240,50 L260,45 L275,60 L280,80 L270,100 L285,120 L290,145 L280,165 L295,180 L300,210 L285,230 L295,255 L290,280 L275,300 L260,315 L265,340 L255,360 L240,375 L235,400 L220,420 L205,435 L195,455 L180,465 L170,480 L155,490 L140,475 L130,455 L120,440 L110,420 L100,400 L95,375 L105,355 L115,335 L110,310 L120,290 L130,270 L125,245 L135,225 L140,200 L130,175 L140,155 L150,130 L145,105 L155,85 L165,65 L185,50 L200,35 Z"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Incident dots */}
              <svg
                viewBox="0 0 400 600"
                className="absolute inset-0 w-full"
              >
                {incidents.slice(0, 80).map((inc) => {
                  if (!inc.latitude || !inc.longitude) return null;
                  const { x, y } = geoToSvg(inc.latitude, inc.longitude);
                  return (
                    <circle
                      key={inc.id}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="white"
                      opacity="0.7"
                      className="animate-pulse-slow"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Bottom stats bar */}
          <div className="border-t border-white/5 px-6 py-4 flex flex-wrap gap-6 justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-white/40">
              <span className="w-2 h-2 rounded-full bg-white/70 inline-block" />
              Varje punkt = 1 incident
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

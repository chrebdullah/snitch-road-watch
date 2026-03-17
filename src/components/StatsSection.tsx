import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Clock, MapPin } from "lucide-react";

export default function StatsSection() {
  const [totalReports, setTotalReports] = useState(21);
  const [last24h, setLast24h] = useState(0);
  const [uniqueCities, setUniqueCities] = useState(0);

  const fetchStats = async () => {
    // Total
    const { count: total } = await supabase
      .from("reports_public")
      .select("id", { count: "exact", head: true });
    setTotalReports(Math.max(total ?? 0, 21));

    // Last 24h
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { count: recent } = await supabase
      .from("reports_public")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterday);
    setLast24h(recent ?? 0);

    // Unique cities
    const { data: cityData } = await supabase
      .from("reports_public")
      .select("city")
      .not("city", "is", null);
    const cities = new Set((cityData || []).map((r: any) => r.city).filter(Boolean));
    setUniqueCities(cities.size);
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("stats-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const stats = [
    { icon: BarChart3, value: totalReports, label: "Totalt antal rapporter" },
    { icon: Clock, value: last24h, label: "Senaste 24 timmarna" },
    { icon: MapPin, value: uniqueCities, label: "Orter representerade" },
  ];

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-6 rounded-2xl border border-border bg-card text-center"
            >
              <stat.icon size={24} className="mx-auto mb-3 text-accent-brand" />
              <div className="text-4xl font-display font-black text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

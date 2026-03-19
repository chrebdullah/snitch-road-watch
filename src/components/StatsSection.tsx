import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Clock, MapPin, ExternalLink } from "lucide-react";

type Incident = {
  id: string;
  created_at: string;
  masked_reg: string;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
};

type DashboardStatsResponse = {
  total_reports: number;
  last_24h_reports: number;
  unique_locations: number;
  latest_incidents: Incident[];
  error?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
  request_id?: string;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StatsSection() {
  const [totalReports, setTotalReports] = useState<number | null>(null);
  const [last24h, setLast24h] = useState<number | null>(null);
  const [uniqueCities, setUniqueCities] = useState<number | null>(null);
  const [latestIncidents, setLatestIncidents] = useState<Incident[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setStatsError(null);
      const endpoint = new URL("/.netlify/functions/dashboard-stats", window.location.origin).toString();
      const response = await fetch(endpoint, { method: "GET" });
      const payload = (await response.json()) as DashboardStatsResponse;

      if (!response.ok) {
        const failureMessage = payload?.error || `Kunde inte hämta dashboard-statistik (HTTP ${response.status}).`;
        console.error("StatsSection: dashboard-statistik misslyckades", {
          endpoint,
          status: response.status,
          error: payload?.error || null,
          details: payload?.details || null,
          hint: payload?.hint || null,
          code: payload?.code || null,
          request_id: payload?.request_id || null,
        });
        setStatsError(failureMessage);
        setTotalReports(null);
        setLast24h(null);
        setUniqueCities(null);
        setLatestIncidents([]);
        return;
      }

      setTotalReports(typeof payload.total_reports === "number" ? payload.total_reports : 0);
      setLast24h(typeof payload.last_24h_reports === "number" ? payload.last_24h_reports : 0);
      setUniqueCities(typeof payload.unique_locations === "number" ? payload.unique_locations : 0);
      setLatestIncidents(Array.isArray(payload.latest_incidents) ? payload.latest_incidents : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Okänt fel vid hämtning av dashboard-statistik.";
      console.error("StatsSection: dashboard-statistik misslyckades", {
        error: message,
      });
      setStatsError(message);
      setTotalReports(null);
      setLast24h(null);
      setUniqueCities(null);
      setLatestIncidents([]);
    }
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

  const handleIncidentClick = (incident: Incident) => {
    if (incident.latitude !== null && incident.longitude !== null) {
      const coords = `${incident.latitude},${incident.longitude}`;
      window.open(`https://www.google.com/maps?q=${coords}`, "_blank", "noopener,noreferrer");
      return;
    }
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  };

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
                {statsError ? "—" : (stat.value ?? "…")}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {statsError && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-200">
              Dashboard-statistik kunde inte hämtas. Fel: {statsError}
            </p>
          </div>
        )}

        <div className="mt-6 p-4 sm:p-5 rounded-2xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Senaste incidenter</h3>
          <div className="space-y-2">
            {latestIncidents.length === 0 && (
              <p className="text-xs text-muted-foreground">Inga incidenter att visa ännu.</p>
            )}
            {latestIncidents.map((incident) => (
              <button
                key={incident.id}
                onClick={() => handleIncidentClick(incident)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-left hover:border-foreground/25 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-bold tracking-wider text-foreground truncate">
                    {incident.masked_reg || "***"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {incident.location_label || "Plats saknas"} · {formatDate(incident.created_at)}
                  </p>
                </div>
                <ExternalLink size={14} className="text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

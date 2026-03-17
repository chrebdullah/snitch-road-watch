import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Calendar } from "lucide-react";
import ReportsMap from "@/components/ReportsMap";

type Report = {
  id: string;
  created_at: string;
  masked_reg: string;
  city: string | null;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Rapporter() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("reports_public")
        .select("id, created_at, masked_reg, city")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setReports(data as Report[]);
      setLoading(false);
    };
    fetchReports();
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Rapporterade händelser
          </h1>
          <p className="mt-3 text-white/40 text-base">
            Granskade och godkända händelser. Inga personuppgifter visas.
          </p>
        </div>

        <div className="mb-10 animate-fade-in-up">
          <ReportsMap />
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="text-center py-24 text-white/25">
            <p className="text-lg font-medium">Inga godkända händelser än</p>
            <p className="text-sm mt-2">Var den första att rapportera!</p>
          </div>
        )}

        <div className="space-y-2 animate-fade-in-up">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-white/40">
                    {report.masked_reg.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <div className="font-mono font-bold text-white text-sm tracking-widest">
                    {report.masked_reg}
                  </div>
                  {report.city && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-white/30">
                      <MapPin size={10} />
                      {report.city}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-white/25 font-medium">
                <Calendar size={11} />
                {formatDate(report.created_at)}
              </div>
            </div>
          ))}
        </div>

        {!loading && reports.length > 0 && (
          <p className="text-center text-xs text-white/20 mt-8">
            Visar {reports.length} godkända händelser · All data är anonymiserad
          </p>
        )}
      </div>
    </div>
  );
}

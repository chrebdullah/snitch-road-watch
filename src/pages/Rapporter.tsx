import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock3, MapPin } from "lucide-react";
import ReportsMap, { type ReportMapItem } from "@/components/ReportsMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PublicReport = {
  id: string | null;
  created_at: string | null;
  happened_on: string | null;
  approved: boolean | null;
  masked_reg: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  comment: string | null;
  media_url: string | null;
};

type UiReport = {
  id: string;
  createdAt: string | null;
  happenedOn: string | null;
  registrationNumber: string;
  address: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  comment: string | null;
  photoUrl: string | null;
};

function toUiReport(report: PublicReport, index: number): UiReport {
  return {
    id: report.id ?? `fallback-${index}`,
    createdAt: report.created_at,
    happenedOn: report.happened_on,
    registrationNumber: report.masked_reg ?? "Okänd",
    address: report.address ?? "Adress saknas",
    city: report.city,
    latitude: report.latitude,
    longitude: report.longitude,
    comment: report.comment,
    photoUrl: report.media_url,
  };
}

function getReportDate(report: UiReport): string | null {
  return report.happenedOn ?? report.createdAt;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "Okänd tid";

  return new Date(dateStr).toLocaleString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Okänd tid";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Okänd tid";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Nyss";
  if (diffMinutes < 60) return `${diffMinutes} minuter sedan`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} timmar sedan`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} dagar sedan`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} veckor sedan`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} månader sedan`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} år sedan`;
}

function getStreetAddress(address: string): string {
  return address.split(",")[0]?.trim() || address;
}

export default function Rapporter() {
  const [reports, setReports] = useState<UiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("reports_public")
        .select("id, created_at, happened_on, approved, masked_reg, address, city, latitude, longitude, comment, media_url")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(200);

      console.log("[Rapporter] reports_public query result", { data, error });

      if (error) {
        console.error("[Rapporter] Failed to fetch approved reports", error);
      }

      if (data) {
        setReports((data as PublicReport[]).map(toUiReport));
      }

      setLoading(false);
    };

    fetchReports();
  }, []);

  const mapReports = useMemo<ReportMapItem[]>(
    () =>
      reports
        .filter((report) => report.latitude !== null && report.longitude !== null)
        .map((report) => ({
          id: report.id,
          latitude: report.latitude as number,
          longitude: report.longitude as number,
          registrationNumber: report.registrationNumber,
          address: report.address,
          time: getReportDate(report),
          comment: report.comment,
          photoUrl: report.photoUrl,
        })),
    [reports],
  );

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Rapporterade händelser
          </h1>
          <p className="mt-3 text-white/40 text-base">
            Granskade och godkända händelser. Klicka på markörer eller kort för att se detaljer.
          </p>
        </div>

        <div className="mb-10 animate-fade-in-up">
          <ReportsMap
            reports={mapReports}
            selectedReportId={selectedReportId}
            onSelectReport={(report) => setSelectedReportId(report.id)}
          />
        </div>

        <section className="space-y-3 animate-fade-in-up">
          <h2 className="text-xl font-display font-bold text-white">Alla godkända rapporter</h2>

          {loading && (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div className="text-center py-24 text-white/25 rounded-xl border border-white/5 bg-white/[0.02]">
              <p className="text-lg font-medium">Inga godkända händelser än</p>
              <p className="text-sm mt-2">Var den första att rapportera!</p>
            </div>
          )}

          {!loading && reports.map((report) => (
            <button
              type="button"
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className="w-full text-left flex items-center justify-between p-5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-white/40">
                    {report.registrationNumber.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <div className="font-mono font-bold text-white text-sm tracking-widest">
                    {report.registrationNumber}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-white/35">
                    <MapPin size={11} />
                    {getStreetAddress(report.address)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-white/25 font-medium">
                <Clock3 size={12} />
                {formatTimeAgo(getReportDate(report))}
              </div>
            </button>
          ))}
        </section>

        {!loading && reports.length > 0 && (
          <p className="text-center text-xs text-white/20 mt-8">
            Visar {reports.length} godkända händelser · All data är anonymiserad
          </p>
        )}
      </div>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-xl bg-black border border-white/10 text-white">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display font-black">{selectedReport.registrationNumber}</DialogTitle>
                <DialogDescription className="text-white/45">
                  Detaljer för rapporterad händelse
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-start gap-2 text-sm text-white/80">
                    <MapPin size={15} className="mt-0.5 text-white/50" />
                    <span>{selectedReport.address}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-white/80">
                    <Calendar size={15} className="mt-0.5 text-white/50" />
                    <span>{formatDateTime(getReportDate(selectedReport))}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-xs uppercase tracking-widest text-white/35 mb-2">Kommentar</p>
                  <p className="text-sm text-white/75 leading-relaxed">
                    {selectedReport.comment?.trim() ? selectedReport.comment : "Ingen kommentar angiven"}
                  </p>
                </div>

                {selectedReport.photoUrl && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-xs uppercase tracking-widest text-white/35 mb-3">Foto</p>
                    <img
                      src={selectedReport.photoUrl}
                      alt="Rapporterat foto"
                      className="w-full max-h-[360px] object-cover rounded-lg border border-white/10"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

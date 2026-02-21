import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function HeroSection() {
  const [reportCount, setReportCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("reports_public")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setReportCount(count ?? 0));
  }, []);

  const scrollToMap = () => {
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24 overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02] blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in-up">
        {/* Badge */}
        {reportCount !== null && reportCount > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            Live – {reportCount} rapporterade incidenter
          </div>
        )}

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display font-black tracking-tighter leading-[0.95] text-white">
          Gör Sveriges
          <br />
          <span className="text-gradient">vägar säkrare.</span>
        </h1>

        {/* Subheadline */}
        <p className="max-w-xl mx-auto text-lg sm:text-xl text-white/50 leading-relaxed">
          Rapportera farlig mobilanvändning bakom ratten.{" "}
          <span className="text-white/80">Anonymt. Direkt.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            to="/rapportera"
            className="group flex items-center gap-2 px-8 py-4 bg-white text-black font-bold text-base rounded-full hover:bg-white/90 transition-all duration-200 active:scale-95"
          >
            Rapportera nu
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <button
            onClick={scrollToMap}
            className="px-8 py-4 border border-white/15 text-white/80 font-semibold text-base rounded-full hover:border-white/30 hover:text-white transition-all duration-200"
          >
            Se statistik
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-8 pt-8 border-t border-white/5">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-white">
              {reportCount ?? "–"}
            </div>
            <div className="text-xs text-white/40 mt-1">Rapporter</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-display font-black text-white">100%</div>
            <div className="text-xs text-white/40 mt-1">Anonymt</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToMap}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 hover:text-white/40 transition-colors animate-bounce"
      >
        <ChevronDown size={24} />
      </button>
    </section>
  );
}

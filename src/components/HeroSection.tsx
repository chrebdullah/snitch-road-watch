import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";

export default function HeroSection() {
  const scrollToMap = () => {
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-brand/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in-up">
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display font-black tracking-tighter leading-[0.95] text-foreground">
          Gör Sveriges
          <br />
          <span className="text-gradient">vägar säkrare.</span>
        </h1>

        <p className="max-w-xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed">
          Rapportera farlig mobilanvändning bakom ratten.{" "}
          <span className="text-foreground/80">Anonymt. Direkt.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            to="/rapportera"
            className="group flex items-center gap-2 px-8 py-4 min-h-[56px] bg-accent-brand text-accent-brand-foreground font-bold text-base rounded-full hover:opacity-90 transition-all duration-200 active:scale-95"
          >
            Rapportera nu
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <button
            onClick={scrollToMap}
            className="px-8 py-4 min-h-[48px] border border-border text-foreground/80 font-semibold text-base rounded-full hover:border-foreground/30 hover:text-foreground transition-all duration-200"
          >
            Se statistik
          </button>
        </div>
      </div>

      <button
        onClick={scrollToMap}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-foreground transition-colors animate-bounce"
      >
        <ChevronDown size={24} />
      </button>
    </section>
  );
}

import snitchLogo from "@/assets/snitch-logo.png";

export default function Om() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="mb-12 text-center">
          <img src={snitchLogo} alt="SNITCH" className="w-16 h-16 mx-auto invert mb-6" />
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Om SNITCH
          </h1>
        </div>

        <div className="space-y-8">
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="prose prose-invert max-w-none">
              <p className="text-white/70 text-lg leading-relaxed">
                Jag heter Emanuel och är 14 år och blev sur när jag nästan blev påkörd av en bil
                där föraren tittade på sin mobil. När jag förstod att det var olagligt så began
                jag bygga denna lösning.
              </p>
              <p className="text-white/50 text-base leading-relaxed mt-4">
                Swisha mig gärna en gåva om ni vill stötta mitt arbete i att stoppa farliga bilister.
              </p>
            </div>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <h2 className="text-xl font-display font-bold text-white">Swisha en gåva</h2>
            <p className="text-white/50 text-sm">
              Om du vill stötta arbetet för säkrare vägar kan du swisha direkt till:
            </p>
            <div className="font-display font-black text-3xl text-white tracking-tight">
              +46 73 508 26 08
            </div>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <h2 className="text-xl font-display font-bold text-white">Rättslig grund</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Mobilanvändning under körning regleras av:
            </p>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-sm font-mono text-white/60">
                4 kap. 10 e § trafikförordningen (2017:1284)
              </p>
              <p className="text-sm text-white/40 mt-2 leading-relaxed">
                "Föraren får inte använda mobiltelefon på ett sådant sätt att den hålls i handen under färd."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

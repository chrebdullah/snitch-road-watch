import { Camera, FileText, Send, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Camera,
    number: "01",
    title: "Ta bild eller video",
    description: "Fotografera eller filma fordonet med din kamera. Metadata extraheras automatiskt.",
  },
  {
    icon: FileText,
    number: "02",
    title: "Fyll i registreringsnummer",
    description: "Ange registreringsnumret på det rapporterade fordonet.",
  },
  {
    icon: Send,
    number: "03",
    title: "Skicka anonymt",
    description: "Din rapport skickas anonymt. Ingen inloggning krävs.",
  },
  {
    icon: BarChart3,
    number: "04",
    title: "Se statistik i realtid",
    description: "Rapporter sammanställs och visas på kartan i realtid.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-display font-black text-white">
            Hur det funkar
          </h2>
          <p className="mt-4 text-white/40 text-base">
            Fyra enkla steg för att göra vägarna säkrare
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden">
          {steps.map((step, i) => (
            <div
              key={i}
              className="p-8 bg-black hover:bg-white/[0.02] transition-colors group"
            >
              <div className="mb-6">
                <span className="text-xs font-mono text-white/20 font-bold">{step.number}</span>
                <div className="mt-3 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  <step.icon size={18} className="text-white/60" />
                </div>
              </div>
              <h3 className="text-base font-display font-bold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

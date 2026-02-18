import { Shield } from "lucide-react";

const sections = [
  {
    title: "Ingen personlig data publiceras",
    content:
      "Inga personuppgifter om förare eller anmälare publiceras offentligt. Registreringsnummer maskeras alltid i den publika listan.",
  },
  {
    title: "Media är inte automatiskt offentligt",
    content:
      "Uppladdade bilder och videor görs aldrig automatiskt offentliga. Allt mediamaterial kräver manuell granskning och godkännande av administratör.",
  },
  {
    title: "Administratörsgranskning krävs",
    content:
      "Alla inkommande rapporter granskas av en administratör innan de eventuellt godkänns för publik visning.",
  },
  {
    title: "GDPR-efterlevnad",
    content:
      "SNITCH behandlar all data i enlighet med GDPR (EU 2016/679). Du har rätt att begära radering av data som kan kopplas till dig.",
  },
  {
    title: "Anonym inlämning",
    content:
      "Inga konton krävs för att lämna in rapporter. Vi samlar in minimal metadata (tidpunkt, enhetstyp) för spamskydd.",
  },
  {
    title: "Rättslig referens",
    content: `Rapportering grundar sig på:

4 kap. 10 e § trafikförordningen (2017:1284)

"Föraren får inte använda mobiltelefon på ett sådant sätt att den hålls i handen under färd."`,
  },
];

export default function Integritet() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium mb-6">
            <Shield size={12} />
            GDPR-kompatibel
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Integritet & Villkor
          </h1>
          <p className="mt-4 text-white/40 text-base">
            Vi tar din integritet och säkerheten för alla inblandade på allvar.
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section, i) => (
            <div key={i} className="p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 transition-colors">
              <h2 className="font-display font-bold text-white text-base mb-2">
                {section.title}
              </h2>
              <p className="text-white/45 text-sm leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-xl border border-white/5 bg-white/[0.01]">
          <p className="text-xs text-white/25 leading-relaxed">
            Senast uppdaterad: februari 2026. SNITCH är ett privat initiativ av en privatperson.
            För frågor om integritet, kontakta oss via den offentliga Swish-profilen.
          </p>
        </div>
      </div>
    </div>
  );
}

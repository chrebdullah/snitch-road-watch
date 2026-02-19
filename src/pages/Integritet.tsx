import { Shield, Check } from "lucide-react";

const bulletPoints = [
  "Ingen inloggning krävs – inga konton, inga profiler",
  "Ingen permanent IP-lagring – hashad IP raderas automatiskt efter 24 timmar",
  "EXIF-metadata rensas från alla uppladdade bilder och videor",
  "Publik vy visar aldrig fullständigt registreringsnummer – alltid maskerat",
  "Publik vy visar endast grov plats (stad/kommun) och datum, aldrig exakt klockslag",
  "Media publiceras aldrig automatiskt – kräver manuellt adminbeslut",
  "Alla rapporter granskas av administratör innan eventuell publicering",
  "Rapporter lagras i max 90 dagar utan adminåtgärd, därefter automatisk radering",
];

const sections = [
  {
    title: "GDPR-efterlevnad",
    content:
      "SNITCH behandlar all data i enlighet med GDPR (EU 2016/679). Du har rätt att begära radering av data som kan kopplas till dig. Kontakta oss om du vill utöva dina rättigheter.",
  },
  {
    title: "Anonym inlämning",
    content:
      "Inga konton krävs för att lämna in rapporter. Vi samlar in minimal metadata enbart för spamskydd. Ingen permanent identifierande information lagras.",
  },
  {
    title: "Rate limiting och missbruksskydd",
    content:
      "För att förhindra missbruk tillämpar vi en hashjad (saltad) IP-kontroll som begränsar antalet rapporter per timme. Denna hash lagras tillfälligt och raderas automatiskt.",
  },
];

export default function Integritet() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium mb-6">
            <Shield size={12} />
            GDPR-kompatibel · Alltid anonym
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Integritet & Villkor
          </h1>
          <p className="mt-4 text-white/40 text-base">
            Din anonymitet är absolut. Aldrig kompromissad.
          </p>
        </div>

        {/* Bullet-point privacy guarantees */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] mb-6">
          <h2 className="font-display font-bold text-white text-lg mb-4">
            Våra garantier
          </h2>
          <ul className="space-y-3">
            {bulletPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check size={14} className="text-white/60 mt-0.5 shrink-0" />
                <span className="text-white/55 text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {sections.map((section, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 transition-colors"
            >
              <h2 className="font-display font-bold text-white text-base mb-2">
                {section.title}
              </h2>
              <p className="text-white/45 text-sm leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Legal reference */}
        <div className="mt-8 p-6 rounded-xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display font-bold text-white text-base mb-3">
            Rättslig referens
          </h2>
          <div className="p-4 rounded-lg bg-white/5 border border-white/5">
            <p className="text-sm font-mono text-white/60">
              4 kap. 10 e § trafikförordningen (2017:1284)
            </p>
            <p className="text-sm text-white/40 mt-2 leading-relaxed">
              "Föraren får inte använda mobiltelefon på ett sådant sätt att den hålls i handen under färd."
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 rounded-xl border border-white/5 bg-white/[0.01]">
          <p className="text-xs text-white/25 leading-relaxed">
            Senast uppdaterad: februari 2026. SNITCH är ett privat initiativ. För frågor om integritet, kontakta oss via Swish-profilen.
          </p>
        </div>
      </div>
    </div>
  );
}

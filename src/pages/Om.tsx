import snitchLogo from "@/assets/logosnitch.png";
import { Smartphone } from "lucide-react";

const SWISH_DEEP_LINK = `swish://payment?phone=46729626225&amount=&message=St%C3%B6d%20SNITCH`;
const SWISH_QR_PAYLOAD_URL = "https://app.swish.nu/1/p/sw/?sw=0729626225&msg=St%C3%B6d%20SNITCH&edit=msg";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(SWISH_QR_PAYLOAD_URL)}&bgcolor=000000&color=ffffff&margin=12`;

export default function Om() {
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="mb-12 text-center">
          <img src={snitchLogo} alt="SNITCH" className="w-52 h-52 sm:w-64 sm:h-64 mx-auto mb-8 object-contain" />
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Om SNITCH
          </h1>
        </div>

        <div className="space-y-8">
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="prose prose-invert max-w-none">
              <p className="text-white/70 text-lg leading-relaxed">
                Jag heter Emanuel och är 14 år och blev sur när jag nästan blev påkörd av en bil
                där föraren tittade på sin mobil. När jag förstod att det var olagligt så började
                jag bygga denna lösning.
              </p>
              <p className="text-white/50 text-base leading-relaxed mt-4">
                Swisha mig gärna en gåva om ni vill stötta mitt arbete i att stoppa farliga bilister.
              </p>
            </div>
          </div>

          {/* Donation block */}
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] space-y-5">
            <h2 className="text-xl font-display font-bold text-white">Donera via Swish</h2>
            <p className="text-white/50 text-sm">
              Om du vill stötta arbetet för säkrare vägar:
            </p>
            {isMobile ? (
              <a
                href={SWISH_DEEP_LINK}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 transition-all"
              >
                <Smartphone size={16} />
                Öppna Swish
              </a>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <div className="p-3 bg-black border border-white/10 rounded-xl">
                  <img src={QR_URL} alt="Swish QR" className="w-52 h-52 rounded-lg" />
                </div>
                <p className="text-xs text-white/30">Skanna med Swish i mobilen</p>
              </div>
            )}
          </div>

          {/* PWA install section */}
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <h2 className="text-xl font-display font-bold text-white">Installera på mobilen</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              SNITCH fungerar som en app direkt i webbläsaren – ingen App Store behövs.
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <p className="text-sm font-semibold text-white/70 mb-1">📱 iPhone / Safari</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Tryck på Dela-ikonen (□↑) → "Lägg till på hemskärmen"
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <p className="text-sm font-semibold text-white/70 mb-1">🤖 Android / Chrome</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Tryck på menyn (⋮) → "Installera app" eller "Lägg till på startskärmen"
                </p>
              </div>
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

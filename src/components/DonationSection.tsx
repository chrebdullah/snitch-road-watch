import { Heart, Smartphone } from "lucide-react";

const SWISH_NUMBER = "46729626225";
const SWISH_DISPLAY = "+46 72-962 62 25";
const SWISH_DEEP_LINK = `swish://payment?phone=${SWISH_NUMBER}&amount=&message=St%C3%B6d%20SNITCH`;
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SWISH_DEEP_LINK)}&bgcolor=000000&color=ffffff&margin=16`;

export default function DonationSection() {
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  return (
    <section id="donation" className="py-24 px-4 border-t border-white/5">
      <div className="max-w-xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium">
          <Heart size={12} />
          Stöd SNITCH
        </div>

        <h2 className="text-4xl sm:text-5xl font-display font-black text-white">
          Stöd arbetet för säkrare vägar
        </h2>

        <p className="text-white/50 text-base leading-relaxed">
          Swisha en gåva om du vill stötta arbetet. Varje krona gör skillnad.
        </p>

        <div className="flex flex-col items-center gap-5">
          {isMobile ? (
            /* Mobile: deep link button + small QR */
            <>
              <a
                href={SWISH_DEEP_LINK}
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-white text-black font-bold text-base rounded-full hover:bg-white/90 transition-all active:scale-95"
              >
                <Smartphone size={18} />
                Donera via Swish
              </a>
              <p className="text-xs text-white/25">{SWISH_DISPLAY}</p>
            </>
          ) : (
            /* Desktop: QR code + instructions */
            <>
              <div className="p-4 bg-black border border-white/10 rounded-2xl">
                <img
                  src={QR_URL}
                  alt="Swish QR-kod"
                  className="w-44 h-44 rounded-xl"
                />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm text-white/50 font-medium">
                  Skanna med Swish i mobilen
                </p>
                <p className="text-xs text-white/25">{SWISH_DISPLAY}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

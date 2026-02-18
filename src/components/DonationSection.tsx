import { Heart } from "lucide-react";

// Swish QR: dynamically generate via an open QR endpoint
const SWISH_NUMBER = "0735082608";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=swish%3A%2F%2F${SWISH_NUMBER}&bgcolor=000000&color=ffffff&margin=16`;

export default function DonationSection() {
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

        <div className="flex flex-col items-center gap-4">
          {/* QR Code */}
          <div className="p-4 bg-black border border-white/10 rounded-2xl">
            <img
              src={QR_URL}
              alt="Swish QR-kod"
              className="w-40 h-40 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-white/30 font-medium uppercase tracking-widest">
              Swishnummer
            </p>
            <p className="text-2xl font-display font-black text-white tracking-tight">
              +46 73 508 26 08
            </p>
          </div>

          <a
            href={`swish://payment?data={"version":1,"payee":{"value":"${SWISH_NUMBER}","editable":false},"message":{"value":"SNITCH donation","editable":true}}`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 transition-all"
          >
            Öppna Swish
          </a>
        </div>
      </div>
    </section>
  );
}

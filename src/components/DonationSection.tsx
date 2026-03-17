import { Heart, Smartphone } from "lucide-react";

const SWISH_NUMBER = "46729626225";
const SWISH_DISPLAY = "+46 72-962 62 25";
const SWISH_DEEP_LINK = `swish://payment?phone=${SWISH_NUMBER}&amount=&message=St%C3%B6d%20SNITCH`;
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(SWISH_DEEP_LINK)}&bgcolor=0a0a0a&color=ffffff&margin=8`;

export default function DonationSection() {
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  return (
    <section id="donera" className="py-12 px-4 border-t border-border">
      <div className="max-w-xl mx-auto text-center space-y-4">
        <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Heart size={14} className="text-accent-brand" />
          Stöd SNITCH – Swisha valfritt belopp
        </p>
        {isMobile ? (
          <a
            href={SWISH_DEEP_LINK}
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-accent-brand text-accent-brand-foreground font-bold text-sm rounded-full transition-all active:scale-95"
          >
            <Smartphone size={15} /> Öppna Swish
          </a>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <img src={QR_URL} alt="Swish QR" className="w-28 h-28 rounded-xl" />
            <p className="text-xs text-muted-foreground/50">{SWISH_DISPLAY}</p>
          </div>
        )}
      </div>
    </section>
  );
}

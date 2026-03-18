import { Heart, Smartphone } from "lucide-react";

const SWISH_NUMBER = "0729626225";
const SWISH_DEEP_LINK = "swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220729626225%22%2C%22editable%22%3Afalse%7D%2C%22amount%22%3A%7B%22value%22%3A50%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Stod%20SNITCH%22%2C%22editable%22%3Atrue%7D%7D";

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
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 min-h-[56px] bg-accent-brand text-black font-bold text-lg rounded-full transition-all active:scale-95"
          >
            <Smartphone size={18} /> Öppna Swish
          </a>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-4xl sm:text-5xl font-black tracking-wide text-white">{SWISH_NUMBER}</p>
            <p className="text-xs text-muted-foreground/50">Öppna Swish och ange numret manuellt</p>
          </div>
        )}
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import snitchLogo from "@/assets/logosnitch.png";

const SWISH_DEEP_LINK = `swish://payment?phone=46729626225&amount=&message=St%C3%B6d%20SNITCH`;

export default function Footer() {
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  const handleDonate = (e: React.MouseEvent) => {
    if (isMobile) {
      // Let the href do the work
    } else {
      e.preventDefault();
      document.getElementById("donera")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="border-t border-white/5 py-12 px-4 mt-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={snitchLogo} alt="SNITCH" className="w-5 h-5 invert" />
          <span className="font-display font-black text-sm text-white">SNITCH</span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/25">
          <Link to="/integritet" className="hover:text-white/50 transition-colors">Integritet</Link>
          <Link to="/om" className="hover:text-white/50 transition-colors">Om</Link>
          <Link to="/rapportera" className="hover:text-white/50 transition-colors">Rapportera</Link>
          <Link to="/rapporter" className="hover:text-white/50 transition-colors">Händelser</Link>
          <a
            href={isMobile ? SWISH_DEEP_LINK : "/#donera"}
            onClick={handleDonate}
            className="hover:text-white/50 transition-colors"
          >
            Donera
          </a>
        </div>

        <p className="text-xs text-white/15">
          Ett initiativ för säkrare vägar
        </p>
      </div>
    </footer>
  );
}

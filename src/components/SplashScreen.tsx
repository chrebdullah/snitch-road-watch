import { useEffect, useState } from "react";
import snitchLogo from "@/assets/logosnitch.png";

interface SplashScreenProps {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem("snitch_splash_seen");
    if (alreadySeen) {
      setVisible(false);
      onContinue();
    }
  }, [onContinue]);

  const handleContinue = () => {
    sessionStorage.setItem("snitch_splash_seen", "1");
    setVisible(false);
    onContinue();
  };

  if (!visible) return null;

  return (
    <div className="splash-overlay animate-fade-in">
      <div className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="animate-fade-in-delay-1">
          <img
            src={snitchLogo}
            alt="SNITCH Logo"
            className="w-72 h-72 object-contain"
          />
        </div>

        <div className="animate-fade-in-delay-2 space-y-3">
          <h1 className="text-6xl font-display font-black tracking-tighter text-white">
            SNITCH
          </h1>
          <p className="text-lg text-white font-medium">
            Anmäl farlig mobilanvändning i trafiken
          </p>
          <p className="text-sm text-white/50">
            Ett initiativ för säkrare vägar
          </p>
        </div>

        <div className="animate-fade-in-delay-3 mt-4">
          <button
            onClick={handleContinue}
            className="px-10 py-3.5 bg-white text-black font-semibold text-base rounded-full hover:bg-white/90 transition-all duration-200 active:scale-95"
          >
            Fortsätt
          </button>
        </div>
      </div>
    </div>
  );
}

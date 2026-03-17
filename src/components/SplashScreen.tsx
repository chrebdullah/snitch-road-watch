import { useEffect, useState } from "react";
import snitchLogo from "@/assets/logosnitch.png";

interface SplashScreenProps {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem("snitch_splash_seen");
    if (alreadySeen) {
      setVisible(false);
      onContinue();
      return;
    }

    // Auto-dismiss after 600ms
    const timer = setTimeout(() => {
      sessionStorage.setItem("snitch_splash_seen", "1");
      setFadingOut(true);
      setTimeout(() => {
        setVisible(false);
        onContinue();
      }, 300);
    }, 600);

    return () => clearTimeout(timer);
  }, [onContinue]);

  if (!visible) return null;

  return (
    <div className={`splash-overlay animate-fade-in ${fadingOut ? "splash-fade-out" : ""}`}>
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <img src={snitchLogo} alt="SNITCH" className="w-96 h-96 max-w-[80vw] max-h-[80vw] object-contain" />
        <h1 className="text-4xl font-display font-black tracking-tighter text-foreground">
          SNITCH
        </h1>
        <p className="text-sm text-muted-foreground">
          Säkrare vägar, en rapport i taget
        </p>
      </div>
    </div>
  );
}

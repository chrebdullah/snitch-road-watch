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
      <img
        src={snitchLogo}
        alt="SNITCH"
        className="w-[95vmin] h-[95vmin] max-w-[95vw] max-h-[95dvh] object-contain"
      />
    </div>
  );
}

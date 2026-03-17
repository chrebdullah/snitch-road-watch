import { useEffect, useState } from "react";
import snitchLogo from "@/assets/logosnitch.png";
import snitchMark from "@/assets/snitch-logo.png";

interface SplashScreenProps {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const DISPLAY_MS = 420;
    const FADE_MS = 180;

    const fadeTimer = setTimeout(() => setFadingOut(true), DISPLAY_MS);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      onContinue();
    }, DISPLAY_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onContinue]);

  if (!visible) return null;

  return (
    <div className={`splash-overlay ${fadingOut ? "splash-fade-out" : ""}`}>
      <img src={snitchMark} alt="" aria-hidden="true" className="splash-mascot" />
      <div className="splash-logo-wrap">
        <img src={snitchLogo} alt="SNITCH" className="w-[132px] max-w-[45vw] h-auto object-contain" />
      </div>
    </div>
  );
}

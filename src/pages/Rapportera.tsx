import { useState, useRef } from "react";
import { Camera, MapPin, Upload, CheckCircle, AlertCircle, Smartphone } from "lucide-react";

const SWISH_DEEP_LINK = `swish://payment?phone=46729626225&amount=&message=St%C3%B6d%20SNITCH`;

type Status = "idle" | "uploading" | "success" | "error";

const SWEDISH_REG_REGEX = /^[A-ZÅÄÖa-zåäö]{2,3}\s?[0-9]{2,4}$/;

function validateSwedishReg(reg: string): boolean {
  return SWEDISH_REG_REGEX.test(reg.trim());
}

export default function Rapportera() {
  const [regNumber, setRegNumber] = useState("");
  
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // honeypot – hidden from real users, bots fill it in
  const [honeypot] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      setErrorMsg("Filen är för stor. Max 50MB.");
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const requestLocation = () => {
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanReg = regNumber.trim().toUpperCase();
    if (!cleanReg) {
      setErrorMsg("Registreringsnummer är obligatoriskt.");
      return;
    }
    if (!validateSwedishReg(cleanReg)) {
      setErrorMsg("Ogiltigt format. Exempel: ABC 123 eller ABC123");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("reg_number", cleanReg.replace(/\s/g, ""));
      formData.append("is_public", "false");
      formData.append("website", honeypotValue); // honeypot
      if (location) {
        formData.append("latitude", String(location.lat));
        formData.append("longitude", String(location.lng));
      }
      if (file) {
        formData.append("file", file);
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-report`,
        {
          method: "POST",
          headers: { apikey: anonKey },
          body: formData,
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        setStatus("error");
        setErrorMsg(json.error ?? "Något gick fel. Försök igen.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Nätverksfel. Kontrollera din anslutning och försök igen.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <CheckCircle size={56} className="mx-auto text-white" strokeWidth={1.5} />
          <h1 className="text-3xl font-display font-black text-white">
            Tack för att du gör vägarna säkrare.
          </h1>
          <p className="text-white/50">
            Din rapport är mottagen och behandlas anonymt.
          </p>
          <p className="text-white/30 text-sm">
            Rapporter kan sammanställas och delas med relevanta aktörer.
          </p>

          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] text-left space-y-4">
            <p className="text-sm text-white/60 font-medium">Stöd SNITCH – Donera via Swish</p>
            {isMobile ? (
              <a
                href={SWISH_DEEP_LINK}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 transition-all"
              >
                <Smartphone size={15} />
                Öppna Swish
              </a>
            ) : (
              <p className="text-xs text-white/30">
                Skanna QR-koden i donationsektionen på startsidan.
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setStatus("idle");
              setRegNumber("");
              setFile(null);
              setFilePreview(null);
              setLocation(null);
              setLocationStatus("idle");
              setAllowPublic(false);
            }}
            className="px-6 py-3 border border-white/15 text-white/70 text-sm font-medium rounded-full hover:border-white/30 hover:text-white transition-all"
          >
            Skicka en ny rapport
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-10 text-center animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white">
            Rapportera
          </h1>
          <p className="mt-3 text-white/40 text-base">
            Helt anonym – ingen inloggning krävs
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">
          {/* Honeypot – visually hidden from real users */}
          <div className="absolute -left-[9999px] -top-[9999px] aria-hidden">
            <input
              type="text"
              name="website"
              value={honeypotValue}
              onChange={(e) => setHoneypotValue(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* File upload */}
          <div
            className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-white/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-cover" />
            ) : file ? (
              <div className="space-y-2">
                <Upload size={28} className="mx-auto text-white/30" />
                <p className="text-sm text-white/50">{file.name}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Camera size={32} className="mx-auto text-white/20" />
                <div>
                  <p className="text-sm font-medium text-white/60">Ta bild eller ladda upp video</p>
                  <p className="text-xs text-white/25 mt-1">JPG, PNG, MP4 – max 50MB · EXIF rensas automatiskt</p>
                </div>
              </div>
            )}
          </div>

          {/* Reg number */}
          <div className="space-y-2">
            <label className="text-xs text-white/40 font-medium uppercase tracking-widest">
              Registreringsnummer *
            </label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="ABC 123"
              maxLength={10}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-lg font-mono font-bold placeholder:text-white/15 focus:outline-none focus:border-white/30 transition-colors uppercase tracking-widest"
              required
            />
            <p className="text-xs text-white/20">Format: ABC 123 eller ABC123</p>
          </div>

          {/* GPS location – user-approved only */}
          <div className="space-y-2">
            <label className="text-xs text-white/40 font-medium uppercase tracking-widest">
              Plats (valfritt)
            </label>
            <button
              type="button"
              onClick={requestLocation}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-sm font-medium ${
                locationStatus === "granted"
                  ? "border-white/20 bg-white/5 text-white/70"
                  : locationStatus === "denied"
                  ? "border-red-500/20 bg-red-500/5 text-red-400/70"
                  : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
              }`}
            >
              <MapPin size={16} />
              {locationStatus === "idle" && "Tillåt GPS-plats (valfritt)"}
              {locationStatus === "loading" && "Hämtar plats..."}
              {locationStatus === "granted" && `Plats registrerad (grov plats)`}
              {locationStatus === "denied" && "Plats nekad – fortsätter utan"}
            </button>
            <p className="text-xs text-white/20">
              Används enbart för geografisk statistik. Ingen exakt adress sparas.
            </p>
          </div>

          {/* Reports are always anonymous */}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "uploading"}
            className="w-full py-4 bg-white text-black font-bold text-base rounded-full hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "uploading" ? "Skickar..." : "SKICKA RAPPORT"}
          </button>

          <p className="text-center text-xs text-white/20">
            Din rapport är anonym och behandlas konfidentiellt · Ingen inloggning krävs
          </p>
        </form>
      </div>
    </div>
  );
}

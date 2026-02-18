import { useState, useRef } from "react";
import { Camera, MapPin, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maskRegNumber } from "@/lib/supabase";

type Status = "idle" | "uploading" | "success" | "error";

export default function Rapportera() {
  const [regNumber, setRegNumber] = useState("");
  const [allowPublic, setAllowPublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
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
    if (!regNumber.trim()) {
      setErrorMsg("Registreringsnummer är obligatoriskt.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    let mediaUrl: string | null = null;

    if (file) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("report-media")
        .upload(fileName, file);
      if (!uploadError) {
        mediaUrl = fileName;
      }
    }

    const cleanReg = regNumber.trim().toUpperCase().replace(/\s/g, "");
    const masked = maskRegNumber(cleanReg);

    const { error } = await supabase.from("reports").insert({
      reg_number: cleanReg,
      masked_reg: masked,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      city: null,
      media_url: mediaUrl,
      is_public: allowPublic,
      approved: false,
      device_metadata: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg("Något gick fel. Försök igen.");
    } else {
      setStatus("success");
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
          <p className="text-white/50">Din anmälan är registrerad och väntar på granskning.</p>

          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] text-left space-y-3">
            <p className="text-sm text-white/60 font-medium">Stöd SNITCH – Donera via Swish</p>
            <p className="text-xl font-display font-black text-white">+46 73 508 26 08</p>
            <p className="text-xs text-white/30">
              Swisha en gåva om du vill stötta arbetet för säkrare vägar.
            </p>
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
            Anonym anmälan – ingen inloggning krävs
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">
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
                  <p className="text-xs text-white/25 mt-1">JPG, PNG, MP4 – max 50MB</p>
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
          </div>

          {/* Timestamp (auto) */}
          <div className="space-y-2">
            <label className="text-xs text-white/40 font-medium uppercase tracking-widest">
              Tidpunkt
            </label>
            <div className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3.5 text-white/40 text-sm font-mono">
              {new Date().toLocaleString("sv-SE")} (automatisk)
            </div>
          </div>

          {/* GPS location */}
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
              {locationStatus === "idle" && "Tillåt GPS-plats"}
              {locationStatus === "loading" && "Hämtar plats..."}
              {locationStatus === "granted" && `Plats registrerad (${location?.lat.toFixed(4)}, ${location?.lng.toFixed(4)})`}
              {locationStatus === "denied" && "Plats nekad – fortsätter utan"}
            </button>
          </div>

          {/* Public checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={allowPublic}
              onChange={(e) => setAllowPublic(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-white"
            />
            <span className="text-sm text-white/50 leading-relaxed">
              Tillåt anonym publicering av denna rapport i den publika listan
            </span>
          </label>

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
            {status === "uploading" ? "Skickar..." : "SKICKA"}
          </button>

          <p className="text-center text-xs text-white/20">
            Din rapport är anonym och behandlas konfidentiellt
          </p>
        </form>
      </div>
    </div>
  );
}

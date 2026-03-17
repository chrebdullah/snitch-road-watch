import { useState, useRef, useEffect } from "react";
import { Camera, MapPin, Upload, CheckCircle, AlertCircle, Smartphone } from "lucide-react";

type Status = "idle" | "uploading" | "success" | "error";

const SWISH_DEEP_LINK = `swish://payment?phone=46729626225&amount=&message=St%C3%B6d%20SNITCH`;

export default function Rapportera() {
  const [regNumber, setRegNumber] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [happenedNow, setHappenedNow] = useState(true);
  const [happenedAt, setHappenedAt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setErrorMsg("Max 50MB."); return; }
    setFile(f);
    setFilePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNumber.trim()) {
      setErrorMsg("Registreringsnummer krävs.");
      return;
    }

    if (!location && !address.trim()) {
      setErrorMsg("Plats krävs. Tillåt GPS eller ange en adress.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("reg_number", regNumber.trim().toUpperCase());
      formData.append("website", honeypotValue);
      if (location) {
        formData.append("latitude", String(location.lat));
        formData.append("longitude", String(location.lng));
      }
      if (address.trim()) formData.append("address", address.trim());
      if (comment.trim()) formData.append("comment", comment.trim());
      if (!happenedNow && happenedAt) formData.append("happened_at", happenedAt);
      if (file) formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-report`,
        { method: "POST", headers: { apikey: anonKey }, body: formData }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        setStatus("error");
        setErrorMsg(json.error ?? "Något gick fel.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Nätverksfel. Försök igen.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
          <CheckCircle size={56} className="mx-auto text-accent-brand" strokeWidth={1.5} />
          <h1 className="text-3xl font-display font-black text-foreground">
            Tack! Rapporten är mottagen.
          </h1>
          <p className="text-muted-foreground">Behandlas anonymt och konfidentiellt.</p>
          {isMobile && (
            
              href={SWISH_DEEP_LINK}
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-accent-brand text-accent-brand-foreground font-bold text-sm rounded-full transition-all"
            >
              <Smartphone size={15} /> Stöd via Swish
            </a>
          )}
          <button
            onClick={() => { setStatus("idle"); setFile(null); setFilePreview(null); setComment(""); setRegNumber(""); setHappenedNow(true); }}
            className="px-6 py-3 min-h-[48px] border border-border text-muted-foreground text-sm font-medium rounded-full hover:border-foreground/30 hover:text-foreground transition-all"
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
        <div className="mb-8 text-center animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-display font-black text-foreground">Rapportera</h1>
          <p className="mt-2 text-muted-foreground">Anonymt – under 10 sekunder</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">
          <div className="absolute -left-[9999px] -top-[9999px]" aria-hidden="true">
            <input type="text" name="website" value={honeypotValue} onChange={(e) => setHoneypotValue(e.target.value)} tabIndex={-1} autoComplete="off" />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Registreringsnummer *</label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="ABC 123"
              maxLength={10}
              autoCapitalize="characters"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 min-h-[56px] text-foreground text-xl font-bold tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Plats *</label>
            <button
              type="button"
              onClick={requestLocation}
              className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] rounded-xl border transition-all text-sm font-medium ${
                locationStatus === "granted"
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : locationStatus === "denied"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <MapPin size={16} />
              {locationStatus === "idle" && "Hämta GPS-plats"}
              {locationStatus === "loading" && "Hämtar..."}
              {locationStatus === "granted" && "✓ Plats registrerad"}
              {locationStatus === "denied" && "GPS nekad – ange adress nedan"}
            </button>
            {locationStatus === "denied" && (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="T.ex. Sveavägen, Stockholm"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 min-h-[48px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Tidpunkt *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHappenedNow(true)}
                className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  happenedNow ? "border-accent-brand bg-accent-brand/10 text-accent-brand" : "border-border text-muted-foreground"
                }`}
              >
                Just nu
              </button>
              <button
                type="button"
                onClick={() => setHappenedNow(false)}
                className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  !happenedNow ? "border-accent-brand bg-accent-brand/10 text-accent-brand" : "border-border text-muted-foreground"
                }`}
              >
                Annan tid
              </button>
            </div>
            {!happenedNow && (
              <input
                type="datetime-local"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 min-h-[48px] text-foreground focus:outline-none focus:border-foreground/30 transition-colors"
              />
            )}
          </div>

          <div
            className="relative border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer hover:border-foreground/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleFile} />
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="max-h-36 mx-auto rounded-xl object-cover" />
            ) : file ? (
              <div className="space-y-1">
                <Upload size={24} className="mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{file.name}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Camera size={28} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Foto/video (valfritt)</p>
                <p className="text-xs text-muted-foreground/40">EXIF rensas automatiskt</p>
              </div>
            )}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kommentar (valfritt)"
            rows={2}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors resize-none"
          />

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "uploading"}
            className="w-full py-4 min-h-[56px] bg-accent-brand text-accent-brand-foreground font-bold text-lg rounded-full hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {status === "uploading" ? "Skickar..." : "SKICKA RAPPORT"}
          </button>

          <p className="text-center text-xs text-muted-foreground/50">
            Anonym rapport · Ingen inloggning krävs
          </p>
        </form>
      </div>
    </div>
  );
}

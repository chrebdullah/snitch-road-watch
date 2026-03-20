import { useState, useRef, useEffect } from "react";
import { Camera, MapPin, Upload, CheckCircle, Smartphone, AlertCircle, X } from "lucide-react";

type Status = "idle" | "uploading" | "success" | "error";
type LocationMode = "gps" | "manual";
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

const SWISH_DEEP_LINK =
  "swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220729626225%22%2C%22editable%22%3Afalse%7D%2C%22amount%22%3A%7B%22value%22%3A50%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Stod%20SNITCH%22%2C%22editable%22%3Atrue%7D%7D";


export default function Rapportera() {
  const [regNumber, setRegNumber] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("gps");
  const [manualAddress, setManualAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [happenedNow, setHappenedNow] = useState(true);
  const [happenedAt, setHappenedAt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);

  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|Android/i.test(userAgent);

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

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
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setErrorMsg("Ogiltig filtyp. Välj en bildfil.");
      setFile(null);
      setFilePreview(null);
      setPreviewFailed(false);
      e.target.value = "";
      return;
    }

    if (selected.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg("Bilden är för stor. Max 15MB.");
      setFile(null);
      setFilePreview(null);
      setPreviewFailed(false);
      e.target.value = "";
      return;
    }

    try {
      const nextPreview = URL.createObjectURL(selected);
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
      setFile(selected);
      setFilePreview(nextPreview);
      setPreviewFailed(false);
      setErrorMsg("");
    } catch (error) {
      console.error("Kunde inte skapa bildförhandsvisning:", error);
      setFile(null);
      setFilePreview(null);
      setPreviewFailed(false);
      setErrorMsg("Kunde inte läsa bilden. Försök med en annan bild.");
      e.target.value = "";
    }
  };

  const clearSelectedFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFile(null);
    setFilePreview(null);
    setPreviewFailed(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const openFilePicker = (targetRef: React.RefObject<HTMLInputElement>) => {
    const input = targetRef.current;
    if (!input) return;

    try {
      if ("showPicker" in input && typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch (error) {
      console.error("showPicker misslyckades, fallback till click():", error);
    }

    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedManualAddress = manualAddress.trim();
    const manualAddressProvided = trimmedManualAddress.length > 0;
    const preferredLocationMode: LocationMode = manualAddressProvided ? "manual" : locationMode;
    const addressToSend = manualAddressProvided ? trimmedManualAddress : "";

    if (!regNumber.trim()) {
      setErrorMsg("Registreringsnummer krävs.");
      return;
    }

    if (!location && !manualAddressProvided) {
      setErrorMsg("Plats krävs. Tillåt GPS eller ange adress.");
      return;
    }

    if (preferredLocationMode === "manual" && !manualAddressProvided) {
      setErrorMsg("Ange en manuell adress eller byt tillbaka till GPS-plats.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      if (honeypotValue.trim()) {
        setStatus("success");
        return;
      }

      const cleanedReg = regNumber.trim().toUpperCase();
      const happenedAtIso = !happenedNow && happenedAt ? new Date(happenedAt).toISOString() : "";
      const formData = new FormData();
      formData.append("reg_number", cleanedReg);
      formData.append("comment", comment.trim());
      formData.append("lat", location?.lat?.toString() ?? "");
      formData.append("lng", location?.lng?.toString() ?? "");
      formData.append("address", addressToSend);
      formData.append("manual_address", trimmedManualAddress);
      formData.append("location_mode", preferredLocationMode);
      formData.append("happened_at", happenedAtIso);
      if (file) {
        formData.append("image", file);
      }

      const submitReportEndpoint = new URL("/.netlify/functions/submit-report", window.location.origin).toString();
      const response = await fetch(submitReportEndpoint, {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const fallback = rawText.trim().slice(0, 120);
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : fallback || "Något gick fel vid inskick.";
        throw new Error(message);
      }

      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMsg(error instanceof Error ? error.message : "Något gick fel.");
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
            <a
              href={SWISH_DEEP_LINK}
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-accent-brand text-accent-brand-foreground font-bold text-sm rounded-full transition-all"
            >
              <Smartphone size={15} /> Stöd via Swish
            </a>
          )}

          <button
            onClick={() => {
              if (filePreview) {
                URL.revokeObjectURL(filePreview);
              }
              setStatus("idle");
              setFile(null);
              setFilePreview(null);
              setComment("");
              setRegNumber("");
              setHappenedNow(true);
              setHappenedAt("");
              setLocationMode("gps");
              setManualAddress("");
              setErrorMsg("");
            }}
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
            <input
              type="text"
              name="website"
              value={honeypotValue}
              onChange={(e) => setHoneypotValue(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              Registreringsnummer *
            </label>
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
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              Plats *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLocationMode("gps")}
                className={`px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  locationMode === "gps"
                    ? "border-accent-brand bg-accent-brand/10 text-accent-brand"
                    : "border-border text-muted-foreground"
                }`}
              >
                Använd min nuvarande plats
              </button>
              <button
                type="button"
                onClick={() => setLocationMode("manual")}
                className={`px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  locationMode === "manual"
                    ? "border-accent-brand bg-accent-brand/10 text-accent-brand"
                    : "border-border text-muted-foreground"
                }`}
              >
                Ange annan plats manuellt
              </button>
            </div>

            <button
              type="button"
              onClick={requestLocation}
              className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] rounded-xl border transition-all text-sm font-medium ${
                locationStatus === "granted"
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : locationStatus === "denied"
                    ? "border-border bg-secondary text-muted-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <MapPin size={16} />
              {locationStatus === "idle" && "Hämta GPS-plats"}
              {locationStatus === "loading" && "Hämtar..."}
              {locationStatus === "granted" && "✓ GPS-plats hämtad (förslag)"}
              {locationStatus === "denied" && "GPS ej tillgänglig"}
            </button>

            {locationMode === "gps" && (
              <button
                type="button"
                onClick={() => setLocationMode("manual")}
                className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-border text-sm font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all"
              >
                Ändra plats
              </button>
            )}

            {(locationMode === "manual" || manualAddress.trim().length > 0 || locationStatus === "denied") && (
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="T.ex. Sveavägen, Stockholm"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 min-h-[48px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors"
              />
            )}

            <p className="text-xs text-muted-foreground/80">
              Plats som skickas:{" "}
              {manualAddress.trim()
                ? `Manuell adress (${manualAddress.trim()})`
                : location
                  ? `Nuvarande GPS (${location.lat.toFixed(5)}, ${location.lng.toFixed(5)})`
                  : "Ingen plats vald ännu"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              Tidpunkt *
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHappenedNow(true)}
                className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  happenedNow
                    ? "border-accent-brand bg-accent-brand/10 text-accent-brand"
                    : "border-border text-muted-foreground"
                }`}
              >
                Just nu
              </button>

              <button
                type="button"
                onClick={() => setHappenedNow(false)}
                className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                  !happenedNow
                    ? "border-accent-brand bg-accent-brand/10 text-accent-brand"
                    : "border-border text-muted-foreground"
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

          <div className="relative border-2 border-dashed border-border rounded-2xl p-6 text-center transition-colors">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />

            {file && filePreview && !previewFailed ? (
              <div className="space-y-3">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-h-36 mx-auto rounded-xl object-cover"
                  onError={() => {
                    console.error("Bild-preview kunde inte renderas.");
                    setPreviewFailed(true);
                    setErrorMsg("Kunde inte visa bilden. Ta bort den och välj en ny.");
                  }}
                />
                <p className="text-xs text-muted-foreground">{file.name}</p>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="mx-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={12} />
                  Ta bort bild
                </button>
              </div>
            ) : file ? (
              <div className="space-y-1">
                <Upload size={24} className="mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{file.name}</p>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="mx-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={12} />
                  Ta bort bild
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Camera size={28} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Bild (valfritt)</p>
                <p className="text-xs text-muted-foreground/40">EXIF rensas automatiskt</p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => openFilePicker(imageInputRef)}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-secondary border border-border text-sm font-medium text-foreground"
              >
                Ta foto
              </button>

              <button
                type="button"
                onClick={() => openFilePicker(imageInputRef)}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl border border-border text-sm font-medium text-muted-foreground"
              >
                Ladda upp bild
              </button>
            </div>
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

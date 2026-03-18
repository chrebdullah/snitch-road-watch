import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Camera, MapPin, Upload, CheckCircle, AlertCircle, Smartphone } from "lucide-react";

type Status = "idle" | "uploading" | "success" | "error";

const SWISH_DEEP_LINK = "swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220729626225%22%2C%22editable%22%3Afalse%7D%2C%22amount%22%3A%7B%22value%22%3A50%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Stod%20SNITCH%22%2C%22editable%22%3Atrue%7D%7D";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, SUPABASE_ANON_KEY);

function maskRegNumber(regNumber: string): string {
  const clean = regNumber.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return "***";
  if (clean.length <= 5) return `${clean.slice(0, 1)}***${clean.slice(-1)}`;
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

function toDateOnlyIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0] ?? null;
}

function extractMissingColumn(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  const message = typeof error.message === "string" ? error.message : "";
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

async function insertAdaptiveReport(candidate: Record<string, unknown>) {
  const record = { ...candidate };
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await supabase
      .from("reports")
      .insert(record as never)
      .select("id")
      .single();

    if (!result.error) {
      return { id: result.data?.id ?? null, error: null };
    }

    lastError = result.error;
    const missingColumn = extractMissingColumn(result.error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(record, missingColumn)) {
      delete record[missingColumn];
      continue;
    }

    break;
  }

  return { id: null, error: lastError };
}

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
  const [infoMsg, setInfoMsg] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

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
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorMsg("Endast bilder stöds.");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setErrorMsg("Bilden är för stor. Max 15MB.");
      return;
    }
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFile(f);
    setFilePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setErrorMsg("");
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
    setInfoMsg("");

    try {
      if (honeypotValue.trim()) {
        setStatus("success");
        return;
      }

      const cleanedReg = regNumber.trim().toUpperCase();
      const happenedOn = toDateOnlyIso(!happenedNow && happenedAt ? happenedAt : null);
      let mediaPath: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        mediaPath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("report-media").upload(mediaPath, file, {
          upsert: false,
          contentType: file.type,
        });

        if (uploadError) {
          throw new Error("Kunde inte ladda upp bilden. Försök igen med en mindre bild.");
        }
      }

      const requestPayload = {
        reg_number: cleanedReg,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        address: address.trim() || null,
        comment: comment.trim() || null,
        happened_at: !happenedNow && happenedAt ? new Date(happenedAt).toISOString() : null,
        media_path: mediaPath,
      };

      const saveReportDirectly = async () => {
        const attempts: Array<Record<string, unknown>> = [
          {
            reg_number: cleanedReg,
            masked_reg: maskRegNumber(cleanedReg),
            latitude: location?.lat ?? null,
            longitude: location?.lng ?? null,
            address: address.trim() || null,
            comment: comment.trim() || null,
            happened_on: happenedOn,
            media_url: mediaPath,
            approved: true,
            source: "web",
          },
          {
            reg_number: cleanedReg,
            masked_reg: maskRegNumber(cleanedReg),
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
            address: address.trim() || null,
            comment: comment.trim() || null,
            happened_on: happenedOn,
            image_url: mediaPath,
            approved: true,
            source: "web",
          },
          {
            reg_number: cleanedReg,
            masked_reg: maskRegNumber(cleanedReg),
            approved: true,
          },
        ];

        for (const candidate of attempts) {
          const { id, error } = await insertAdaptiveReport(candidate);
          if (!error) {
            return id;
          }
        }

        throw new Error("Kunde inte spara rapporten. Försök igen om en stund.");
      };

      let payload: Record<string, unknown> = {};
      try {
        const response = await fetch("/.netlify/functions/submit-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        const rawText = await response.text();
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
      } catch (functionCallError) {
        await saveReportDirectly();
        const fallbackMessage =
          functionCallError instanceof Error ? functionCallError.message : "Okänt fel i serverfunktionen.";
        setInfoMsg(`Rapporten sparades i reservläge. Notiser kan vara fördröjda. (${fallbackMessage.slice(0, 100)})`);
        setStatus("success");
        return;
      }

      if (payload?.email_sent === false) {
        const reportId = typeof payload?.id === "string" ? payload.id : "";
        const suffix = reportId ? ` Referens: ${reportId}.` : "";
        setInfoMsg(`Rapporten sparades, men e-postnotisen kunde inte skickas just nu.${suffix}`);
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
            <a href={SWISH_DEEP_LINK} className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-accent-brand text-accent-brand-foreground font-bold text-sm rounded-full transition-all">
              <Smartphone size={15} /> Stöd via Swish
            </a>
          )}
          {infoMsg && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-accent-brand/10 border border-accent-brand/40 text-xs text-accent-brand-foreground">
              <AlertCircle size={14} />
              {infoMsg}
            </div>
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
              setAddress("");
              setErrorMsg("");
              setInfoMsg("");
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
                  ? "border-border bg-secondary text-muted-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <MapPin size={16} />
              {locationStatus === "idle" && "Hämta GPS-plats"}
              {locationStatus === "loading" && "Hämtar..."}
              {locationStatus === "granted" && "✓ Plats registrerad"}
              {locationStatus === "denied" && "GPS ej tillgänglig – ange adress nedan"}
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
              <button type="button" onClick={() => setHappenedNow(true)} className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${happenedNow ? "border-accent-brand bg-accent-brand/10 text-accent-brand" : "border-border text-muted-foreground"}`}>
                Just nu
              </button>
              <button type="button" onClick={() => setHappenedNow(false)} className={`flex-1 px-4 py-3.5 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${!happenedNow ? "border-accent-brand bg-accent-brand/10 text-accent-brand" : "border-border text-muted-foreground"}`}>
                Annan tid
              </button>
            </div>
            {!happenedNow && (
              <input type="datetime-local" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 min-h-[48px] text-foreground focus:outline-none focus:border-foreground/30 transition-colors" />
            )}
          </div>

          <div className="relative border-2 border-dashed border-border rounded-2xl p-6 text-center transition-colors">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {filePreview ? (
              <div className="space-y-3">
                <img src={filePreview} alt="Preview" className="max-h-36 mx-auto rounded-xl object-cover" />
                <p className="text-xs text-muted-foreground">{file?.name}</p>
              </div>
            ) : file ? (
              <div className="space-y-1">
                <Upload size={24} className="mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{file.name}</p>
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
                onClick={() => cameraRef.current?.click()}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-secondary border border-border text-sm font-medium text-foreground"
              >
                Ta foto
              </button>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl border border-border text-sm font-medium text-muted-foreground"
              >
                Ladda upp bild
              </button>
            </div>
          </div>

          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Kommentar (valfritt)" rows={2} className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30 transition-colors resize-none" />

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <button type="submit" disabled={status === "uploading"} className="w-full py-4 min-h-[56px] bg-accent-brand text-accent-brand-foreground font-bold text-lg rounded-full hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
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

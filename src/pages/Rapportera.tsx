import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Camera, MapPin, Upload, CheckCircle, Smartphone, AlertCircle, X } from "lucide-react";

type Status = "idle" | "uploading" | "success" | "error";
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const STORAGE_BUCKET = (import.meta.env.VITE_REPORT_MEDIA_BUCKET ?? "report-media").trim() || "report-media";

const SWISH_DEEP_LINK = "swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220729626225%22%2C%22editable%22%3Afalse%7D%2C%22amount%22%3A%7B%22value%22%3A50%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Stod%20SNITCH%22%2C%22editable%22%3Atrue%7D%7D";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, SUPABASE_ANON_KEY);

type UploadFailureKind = "bucket_missing" | "permission_denied" | "network" | "unknown";

type SupabaseStorageErrorInfo = {
  message: string;
  statusCode: number | null;
  errorCode: string | null;
};

function readSupabaseStorageError(error: unknown): SupabaseStorageErrorInfo {
  if (!error || typeof error !== "object") {
    return {
      message: typeof error === "string" ? error : "Okänt upload-fel.",
      statusCode: null,
      errorCode: null,
    };
  }

  const candidate = error as Record<string, unknown>;
  const message = typeof candidate.message === "string" ? candidate.message : "Okänt upload-fel.";
  const rawStatusCode = candidate.statusCode;
  const statusCode =
    typeof rawStatusCode === "number"
      ? rawStatusCode
      : typeof rawStatusCode === "string" && Number.isFinite(Number(rawStatusCode))
      ? Number(rawStatusCode)
      : null;
  const errorCode =
    typeof candidate.error === "string"
      ? candidate.error
      : typeof candidate.code === "string"
      ? candidate.code
      : null;

  return { message, statusCode, errorCode };
}

function isNetworkError(message: string): boolean {
  return /failed to fetch|fetch failed|network|load failed|networkerror/i.test(message);
}

function classifyUploadFailure(error: unknown): { kind: UploadFailureKind; userMessage: string; details: SupabaseStorageErrorInfo } {
  const details = readSupabaseStorageError(error);
  const lowered = details.message.toLowerCase();

  if (details.statusCode === 404 || /bucket.+not found|does not exist|invalid bucket/i.test(details.message)) {
    return {
      kind: "bucket_missing",
      userMessage: `Bilduppladdning är inte korrekt konfigurerad. Bucketen "${STORAGE_BUCKET}" saknas i Supabase Storage.`,
      details,
    };
  }

  if (
    details.statusCode === 401 ||
    details.statusCode === 403 ||
    /not authorized|permission denied|row-level security|rls|access denied|unauthorized|forbidden/.test(lowered)
  ) {
    return {
      kind: "permission_denied",
      userMessage: "Bilduppladdning nekades av Supabase Storage (saknad behörighet/policy).",
      details,
    };
  }

  if (isNetworkError(details.message)) {
    return {
      kind: "network",
      userMessage: "Nätverksfel vid bilduppladdning. Kontrollera anslutningen och försök igen.",
      details,
    };
  }

  return {
    kind: "unknown",
    userMessage: "Okänt fel vid bilduppladdning. Försök igen.",
    details,
  };
}

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
  const [previewFailed, setPreviewFailed] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [happenedNow, setHappenedNow] = useState(true);
  const [happenedAt, setHappenedAt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypotValue, setHoneypotValue] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|Android/i.test(userAgent);
  const supportsDirectCameraCapture = /Android/i.test(userAgent);

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
    if (cameraRef.current) {
      cameraRef.current.value = "";
    }
    if (uploadRef.current) {
      uploadRef.current.value = "";
    }
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

        const bucketCheck = await supabase.storage.getBucket(STORAGE_BUCKET);
        if (bucketCheck.error) {
          const classifiedBucketError = classifyUploadFailure(bucketCheck.error);
          if (classifiedBucketError.kind === "bucket_missing" || classifiedBucketError.kind === "network") {
            console.error("Supabase storage bucket check failed", {
              supabaseErrorMessage: classifiedBucketError.details.message,
              statusCode: classifiedBucketError.details.statusCode,
              errorCode: classifiedBucketError.details.errorCode,
              bucketName: STORAGE_BUCKET,
              filePath: mediaPath,
              fileSize: file.size,
              mimeType: file.type,
            });
            throw new Error(classifiedBucketError.userMessage);
          }
          console.warn("Supabase storage bucket could not be verified before upload", {
            supabaseErrorMessage: classifiedBucketError.details.message,
            statusCode: classifiedBucketError.details.statusCode,
            errorCode: classifiedBucketError.details.errorCode,
            bucketName: STORAGE_BUCKET,
            filePath: mediaPath,
            fileSize: file.size,
            mimeType: file.type,
          });
        }

        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(mediaPath, file, {
          upsert: false,
          contentType: file.type,
        });

        if (uploadError) {
          const classified = classifyUploadFailure(uploadError);
          console.error("Supabase storage upload failed", {
            supabaseErrorMessage: classified.details.message,
            statusCode: classified.details.statusCode,
            errorCode: classified.details.errorCode,
            bucketName: STORAGE_BUCKET,
            filePath: mediaPath,
            fileSize: file.size,
            mimeType: file.type,
          });
          throw new Error(classified.userMessage);
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
      const submitReportEndpoint = new URL("/.netlify/functions/submit-report", window.location.origin).toString();
      try {
        const response = await fetch(submitReportEndpoint, {
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
      } catch {
        if (import.meta.env.DEV) {
          await saveReportDirectly();
          setStatus("success");
          return;
        }
        throw new Error(
          "Kunde inte nå rapportfunktionen i produktion. Rapporten sparades inte lokalt för att undvika tappad e-postnotis."
        );
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
            <input ref={cameraRef} type="file" accept="image/*" capture={supportsDirectCameraCapture ? "environment" : undefined} className="hidden" onChange={handleFile} />
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
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
                <p className="text-xs text-muted-foreground">{file?.name}</p>
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
                onClick={() => openFilePicker(cameraRef)}
                className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-secondary border border-border text-sm font-medium text-foreground"
              >
                Ta foto
              </button>
              <button
                type="button"
                onClick={() => openFilePicker(uploadRef)}
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

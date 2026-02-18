import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Trash2, Download, LogOut, Eye, EyeOff } from "lucide-react";

type Report = {
  id: string;
  created_at: string;
  reg_number: string;
  masked_reg: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_public: boolean;
  approved: boolean;
  media_url: string | null;
  device_metadata: Record<string, unknown> | null;
};

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        checkAdminAndLoad(data.session.user.id);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session) checkAdminAndLoad(session.user.id);
      else { setAuthed(false); setIsAdmin(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkAdminAndLoad = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (data) {
      setIsAdmin(true);
      setAuthed(true);
      loadReports();
    } else {
      setIsAdmin(false);
      setAuthed(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
    setIsAdmin(false);
    setReports([]);
  };

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReports(data as Report[]);
    setLoading(false);
  };

  const approve = async (id: string) => {
    await supabase.from("reports").update({ approved: true }).eq("id", id);
    setReports((r) => r.map((rep) => (rep.id === id ? { ...rep, approved: true } : rep)));
  };

  const togglePublic = async (id: string, current: boolean) => {
    await supabase.from("reports").update({ is_public: !current }).eq("id", id);
    setReports((r) => r.map((rep) => (rep.id === id ? { ...rep, is_public: !current } : rep)));
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Radera rapport?")) return;
    await supabase.from("reports").delete().eq("id", id);
    setReports((r) => r.filter((rep) => rep.id !== id));
  };

  const exportCSV = () => {
    const headers = ["id", "created_at", "reg_number", "city", "latitude", "longitude", "approved", "is_public"];
    const rows = reports.map((r) =>
      [r.id, r.created_at, r.reg_number, r.city ?? "", r.latitude ?? "", r.longitude ?? "", r.approved, r.is_public].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snitch-reports.csv";
    a.click();
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-sm w-full space-y-6 animate-fade-in-up">
          <div className="text-center">
            <h1 className="text-3xl font-display font-black text-white">Admin</h1>
            <p className="text-white/40 text-sm mt-1">Logga in för att hantera rapporter</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-post"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Lösenord"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all"
            >
              Logga in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16 text-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-white">Ingen adminbehörighet</h2>
          <p className="text-white/40 text-sm">Ditt konto har inte adminrättigheter.</p>
          <button onClick={handleLogout} className="px-6 py-2.5 border border-white/10 text-white/60 rounded-full text-sm hover:border-white/20 transition-all">
            Logga ut
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-black text-white">Admin Panel</h1>
            <p className="text-white/40 text-sm mt-1">{reports.length} rapporter totalt</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 text-white/60 text-sm rounded-full hover:border-white/20 hover:text-white transition-all"
            >
              <Download size={14} /> Exportera CSV
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 text-white/60 text-sm rounded-full hover:border-white/20 hover:text-white transition-all"
            >
              <LogOut size={14} /> Logga ut
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-display font-black text-white">{reports.length}</div>
            <div className="text-xs text-white/30 mt-1">Totalt</div>
          </div>
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-display font-black text-white">{reports.filter((r) => r.approved).length}</div>
            <div className="text-xs text-white/30 mt-1">Godkända</div>
          </div>
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-display font-black text-white">{reports.filter((r) => !r.approved).length}</div>
            <div className="text-xs text-white/30 mt-1">Väntar</div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-white">{report.reg_number}</span>
                    {!report.approved && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">Väntar</span>
                    )}
                    {report.approved && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Godkänd</span>
                    )}
                    {report.is_public && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Publik</span>
                    )}
                  </div>
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(report.created_at).toLocaleString("sv-SE")}
                    {report.city && ` · ${report.city}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!report.approved && (
                    <button
                      onClick={() => approve(report.id)}
                      className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors"
                      title="Godkänn"
                    >
                      <CheckCircle size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => togglePublic(report.id, report.is_public)}
                    className={`p-2 rounded-lg border transition-colors ${report.is_public ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20" : "bg-white/5 border-white/10 text-white/30 hover:border-white/20"}`}
                    title={report.is_public ? "Göm" : "Publisera"}
                  >
                    {report.is_public ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Radera"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

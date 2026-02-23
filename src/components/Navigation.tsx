import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import snitchLogo from "@/assets/logosnitch.png";
import { Menu, X, Smartphone } from "lucide-react";

const SWISH_DEEP_LINK = `swish://payment?phone=46729626225&amount=&message=St%C3%B6d%20SNITCH`;

const navLinks = [
  { label: "Hur det funkar", href: "/#how-it-works" },
  { label: "Statistik", href: "/#map" },
  { label: "Rapportera", href: "/rapportera" },
  { label: "Visa rapporter", href: "/rapporter" },
  { label: "Integritet", href: "/integritet" },
  { label: "Om SNITCH", href: "/om" },
];

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = /iPhone|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  const handleAnchorClick = (href: string) => {
    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      }
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
    setOpen(false);
  };

  const handleDonateClick = () => {
    if (isMobile) {
      window.location.href = SWISH_DEEP_LINK;
    } else {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
      document.getElementById("donera")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        document.getElementById("donera")?.scrollIntoView({ behavior: "smooth" });
      }
    }
    setOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-black/95 backdrop-blur-md border-b border-white/5" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src={snitchLogo}
              alt="SNITCH"
              className="w-9 h-9 object-contain group-hover:scale-110 transition-transform"
            />
            <span className="font-display font-black text-xl tracking-tight text-white">
              SNITCH
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) =>
              link.href.startsWith("/#") ? (
                <button
                  key={link.label}
                  onClick={() => handleAnchorClick(link.href)}
                  className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? "text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDonateClick}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all"
            >
              {isMobile && <Smartphone size={13} />}
              Donera
            </button>
            <button
              className="lg:hidden text-white p-1"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/98 backdrop-blur-md lg:hidden animate-fade-in">
          <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
            {navLinks.map((link) =>
              link.href.startsWith("/#") ? (
                <button
                  key={link.label}
                  onClick={() => handleAnchorClick(link.href)}
                  className="text-2xl font-display font-bold text-white/80 hover:text-white transition-colors"
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-2xl font-display font-bold text-white/80 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
            <button
              onClick={handleDonateClick}
              className="mt-4 inline-flex items-center gap-2 px-8 py-3 bg-white text-black text-lg font-semibold rounded-full"
            >
              {isMobile && <Smartphone size={18} />}
              Donera via Swish
            </button>
          </div>
        </div>
      )}
    </>
  );
}

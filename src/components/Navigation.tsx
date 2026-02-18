import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import snitchLogo from "@/assets/snitch-logo.png";
import { Menu, X } from "lucide-react";

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
        window.location.href = href;
        return;
      }
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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
              className="w-7 h-7 object-contain invert group-hover:scale-110 transition-transform"
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
            <Link
              to="/#donation"
              onClick={() => {
                if (location.pathname === "/") {
                  setTimeout(() => {
                    document.getElementById("donation")?.scrollIntoView({ behavior: "smooth" });
                  }, 50);
                }
              }}
              className="hidden sm:inline-flex px-4 py-2 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all"
            >
              Donera
            </Link>
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
            <Link
              to="/#donation"
              className="mt-4 px-8 py-3 bg-white text-black text-lg font-semibold rounded-full"
              onClick={() => setOpen(false)}
            >
              Donera
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

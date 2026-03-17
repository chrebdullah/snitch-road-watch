import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-16">
      <div className="text-center space-y-4 animate-fade-in-up">
        <h1 className="text-7xl font-display font-black text-white">404</h1>
        <p className="text-lg text-white/50">Sidan kunde inte hittas</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 transition-all mt-4"
        >
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

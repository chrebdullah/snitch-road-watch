import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Rapportera from "./pages/Rapportera";
import Rapporter from "./pages/Rapporter";
import Om from "./pages/Om";
import Integritet from "./pages/Integritet";
import Admin from "./pages/Admin";
import Navigation from "./components/Navigation";
import SplashScreen from "./components/SplashScreen";
import Footer from "./components/Footer";

const queryClient = new QueryClient();

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {!splashDone && <SplashScreen onContinue={() => setSplashDone(true)} />}
          {splashDone && (
            <>
              <Navigation />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/rapportera" element={<Rapportera />} />
                <Route path="/rapporter" element={<Rapporter />} />
                <Route path="/om" element={<Om />} />
                <Route path="/integritet" element={<Integritet />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Footer />
            </>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

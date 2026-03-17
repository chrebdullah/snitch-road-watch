import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import MapSection from "@/components/MapSection";
import StatsSection from "@/components/StatsSection";
import DonationSection from "@/components/DonationSection";

const Index = () => {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <MapSection />
      <HowItWorks />
      <DonationSection />
    </main>
  );
};

export default Index;

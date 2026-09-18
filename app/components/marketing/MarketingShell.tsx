import { DifferentiatorSection } from "./DifferentiatorSection";
import { FaqSection } from "./FaqSection";
import { FeatureSection } from "./FeatureSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { HeroSection } from "./HeroSection";
import { LandingReviewSection } from "./LandingReviewSection";
import { getApprovedPublicReviews } from "@/app/reviews/publicReviews";
import { ProblemSection } from "./ProblemSection";
import { PricingSection } from "./PricingSection";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";
import { WorkflowSection } from "./WorkflowSection";
import styles from "./MarketingShell.module.css";

export function MarketingShell() {
  // Publication eligibility stays in the shared deterministic source, on the server.
  const reviews = getApprovedPublicReviews();

  return (
    <div className={styles.page}>
      <PublicHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <WorkflowSection />
        <FeatureSection />
        <DifferentiatorSection />
        {reviews.length > 0 && <LandingReviewSection reviews={reviews} />}
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <PublicFooter />
    </div>
  );
}

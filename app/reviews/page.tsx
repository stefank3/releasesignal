import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/marketing/PublicHeader";
import { PublicFooter } from "@/app/components/marketing/PublicFooter";
import styles from "@/app/components/marketing/MarketingShell.module.css";
import { getApprovedPublicReviews } from "./publicReviews";

export const metadata: Metadata = {
  title: "Reviews | Release Signal",
  description:
    "Feedback from Release Signal users and beta participants that has been approved for publication.",
};

export default function ReviewsPage() {
  const reviews = getApprovedPublicReviews();

  return (
    <div className={styles.page}>
      <PublicHeader />
      <main className={styles.lightSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h1 className={styles.sectionTitle}>Reviews</h1>
            <p className={styles.sectionCopy}>
              We publish real feedback only with explicit permission to share
              the quote and its attribution.
            </p>
          </div>
          {reviews.length === 0 ? (
            <section className={styles.featureCard} aria-labelledby="reviews-empty">
              <h2 id="reviews-empty" className={styles.cardTitle}>
                No published reviews yet
              </h2>
              <p className={styles.cardText}>
                Reviews will appear here as feedback is collected and explicitly
                approved for publication during the Release Signal beta.
              </p>
            </section>
          ) : (
            <div className={styles.featureGrid}>
              {reviews.map((review) => (
                <figure key={review.id} className={styles.featureCard}
                  style={{ margin: 0, overflowWrap: "anywhere" }}>
                  <blockquote style={{ margin: 0 }}>
                    <p className={styles.sectionCopy}>{review.quote}</p>
                  </blockquote>
                  <figcaption className={styles.cardText}>
                    <strong>{review.authorName}</strong>
                    {review.authorRole && <div>{review.authorRole}</div>}
                    {review.company && <div>{review.company}</div>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

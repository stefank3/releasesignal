"use client";

import { useId, useState, type KeyboardEvent } from "react";
import type { PublicReviewCandidate } from "@/app/reviews/publicReviews";
import marketing from "./MarketingShell.module.css";
import styles from "./LandingReviewSection.module.css";

export function LandingReviewSection({
  reviews,
}: {
  reviews: readonly PublicReviewCandidate[];
}) {
  const [index, setIndex] = useState(0);
  const headingId = useId();
  const quoteId = useId();
  if (reviews.length === 0) return null;

  const currentIndex = Math.min(index, reviews.length - 1);
  const review = reviews[currentIndex];
  const hasMultiple = reviews.length > 1;
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === reviews.length - 1;

  function move(direction: number) {
    setIndex((previous) =>
      Math.max(0, Math.min(reviews.length - 1, Math.min(previous, reviews.length - 1) + direction)),
    );
  }

  function handleControlKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`${marketing.section} ${marketing.lightSection}`}
      id="customer-reviews"
    >
      <div className={marketing.container}>
        <div className={marketing.sectionHeader}>
          <h2 id={headingId} className={marketing.sectionTitle}>Customer reviews</h2>
        </div>
        <figure id={quoteId} className={`${marketing.featureCard} ${styles.quote}`}>
          <blockquote className={styles.blockquote}>
            <p className={marketing.sectionCopy}>{review.quote}</p>
          </blockquote>
          <figcaption className={marketing.cardText}>
            <strong>{review.authorName}</strong>
            {review.authorRole && <div>{review.authorRole}</div>}
            {review.company && <div>{review.company}</div>}
          </figcaption>
        </figure>
        {hasMultiple && (
          <div className={styles.controls} onKeyDown={handleControlKeyDown}>
            {/* aria-disabled keeps focus stable when a control reaches its boundary. */}
            <button type="button" className={styles.control} aria-controls={quoteId}
              aria-disabled={atStart} onClick={() => { if (!atStart) move(-1); }}>
              Previous review
            </button>
            <p className={styles.position} role="status" aria-live="polite" aria-atomic="true">
              Review {currentIndex + 1} of {reviews.length}
            </p>
            <button type="button" className={styles.control} aria-controls={quoteId}
              aria-disabled={atEnd} onClick={() => { if (!atEnd) move(1); }}>
              Next review
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

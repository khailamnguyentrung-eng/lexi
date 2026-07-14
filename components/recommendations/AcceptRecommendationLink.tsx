"use client";

import Link from "next/link";

interface AcceptRecommendationLinkProps {
  href: string;
  /** RecommendationIssuance id this CTA responds to; null → plain link, nothing to record. */
  issuanceId: string | null;
  className?: string;
  children: React.ReactNode;
}

/**
 * RT-1 ("Consumed", Ch.3 §3.1): the recommendation CTA. Clicking it is the
 * learner ACCEPTING the recommended Action — recorded as Evidence via
 * POST /api/recommendations/accept, fired with keepalive so the request
 * survives the immediate navigation.
 *
 * Recording never blocks or delays the learner's action (Constitution 5.4 —
 * the learner's choice stays effective regardless of logging success), so
 * failures are deliberately swallowed: losing one Evidence row is preferable
 * to breaking navigation.
 */
export function AcceptRecommendationLink({
  href,
  issuanceId,
  className,
  children,
}: AcceptRecommendationLinkProps) {
  function recordAccept() {
    if (!issuanceId) return;
    try {
      void fetch("/api/recommendations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuanceId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // never let Evidence recording interfere with the navigation itself
    }
  }

  return (
    <Link href={href} className={className} onClick={recordAccept}>
      {children}
    </Link>
  );
}

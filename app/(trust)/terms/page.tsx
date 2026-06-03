import type { Metadata } from "next";
import TrustPage from "../TrustPage";
import { PRODUCT_NAME } from "@/lib/product/packageLabels";

export const metadata: Metadata = {
  title: `Terms | ${PRODUCT_NAME}`,
};

export default function TermsPage() {
  return (
    <TrustPage
      eyebrow="Terms"
      title="Terms of Use"
      intro="Draft service-use terms for Release Signal commercial readiness."
      sections={[
        {
          title: "Service purpose",
          body: [
            "Release Signal provides QA assistance, structured test-design support, execution-evidence handling, and deterministic release-readiness signals.",
            "Release Signal does not guarantee defect-free releases, complete test coverage, regulatory approval, or a final release decision.",
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "Users should use the service for lawful QA, product, testing, and release-readiness work.",
            "Users should not attempt to abuse, overload, bypass access controls, reverse engineer protected systems, upload malicious content, or use the service to process content they are not authorized to share.",
          ],
        },
        {
          title: "Human responsibility",
          body: [
            "Release decisions remain the responsibility of the user or the user's organization.",
            "AI-assisted output must be reviewed by a qualified human before it is relied on for product, business, legal, regulatory, or release decisions.",
          ],
        },
      ]}
    />
  );
}

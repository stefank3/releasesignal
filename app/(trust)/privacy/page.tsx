import type { Metadata } from "next";
import TrustPage from "../TrustPage";
import { PRODUCT_NAME } from "@/lib/product/packageLabels";

export const metadata: Metadata = {
  title: `Privacy | ${PRODUCT_NAME}`,
};

export default function PrivacyPage() {
  return (
    <TrustPage
      eyebrow="Privacy"
      title="Privacy Notice"
      intro="A plain-language placeholder privacy notice for Release Signal V1.2."
      sections={[
        {
          title: "Information handled by the product",
          body: [
            "Release Signal may process account, authentication, organization, usage, and QA workspace information needed to operate the service.",
            "User-provided requirements, test plans, reviews, execution evidence, and related workspace content may be stored as structured product artifacts.",
          ],
        },
        {
          title: "Sensitive content",
          body: [
            "Users should avoid uploading production secrets, credentials, private keys, regulated personal data, or other sensitive production information unless a reviewed commercial policy explicitly permits it.",
            "Release Signal is intended to support QA analysis and release-readiness workflows, not to serve as a secret manager or regulated records system.",
          ],
        },
        {
          title: "Compliance claims",
          body: [
            "This draft notice does not claim SOC 2, ISO, HIPAA, GDPR certification, PCI compliance, or any other formal compliance status.",
            "Any future compliance, retention, subprocessors, or data-residency claims should be reviewed and approved before publication.",
          ],
        },
      ]}
    />
  );
}

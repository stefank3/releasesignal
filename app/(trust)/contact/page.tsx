import type { Metadata } from "next";
import TrustPage from "../TrustPage";
import { PRODUCT_NAME } from "@/lib/product/packageLabels";

export const metadata: Metadata = {
  title: `Contact | ${PRODUCT_NAME}`,
};

export default function ContactPage() {
  return (
    <TrustPage
      eyebrow="Contact"
      title="Contact Release Signal"
      intro="Basic contact information for Release Signal commercial readiness."
      sections={[
        {
          title: "Product and operator",
          body: [
            "Release Signal is a QA intelligence and release-readiness product built by Stefan Kajchevski / RSF Labs.",
            "This contact page is a placeholder for commercial launch preparation and should be reviewed before public use.",
          ],
        },
        {
          title: "Contact channel",
          body: [
            "A public support or sales contact address has not been finalized in this repository.",
            "Until a reviewed contact channel is approved, users should use the contact path provided directly by the Release Signal operator.",
          ],
        },
      ]}
    />
  );
}

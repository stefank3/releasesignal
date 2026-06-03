import type { Metadata } from "next";
import TrustPage from "../TrustPage";
import { PRODUCT_NAME } from "@/lib/product/packageLabels";

export const metadata: Metadata = {
  title: `Refund / Cancellation | ${PRODUCT_NAME}`,
};

export default function RefundCancellationPage() {
  return (
    <TrustPage
      eyebrow="Refund / Cancellation"
      title="Refund and Cancellation Placeholder"
      intro="A conservative placeholder for future commercial billing policy."
      sections={[
        {
          title: "Current payment status",
          body: [
            "No payment provider integration is described by this page.",
            "This placeholder does not define invoice, card, bank-transfer, checkout, renewal, or payment-provider behavior.",
          ],
        },
        {
          title: "Future cancellation policy",
          body: [
            "Cancellation and renewal behavior should be defined only after the commercial billing model and payment provider, if any, are approved.",
            "Any future policy should explain how users can cancel, what happens to access after cancellation, and how unused time or credits are handled.",
          ],
        },
        {
          title: "Future refund policy",
          body: [
            "Refund eligibility, review windows, exclusions, and contact paths are not finalized in this repository.",
            "A human-reviewed refund policy should be added before public paid commercial launch.",
          ],
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import TrustPage from "../TrustPage";
import {
  PRODUCT_NAME,
  PRODUCT_PACKAGE_NAMES,
} from "@/lib/product/packageLabels";

export const metadata: Metadata = {
  title: `Trial Terms | ${PRODUCT_NAME}`,
};

export default function TrialTermsPage() {
  return (
    <TrustPage
      eyebrow="Trial Terms"
      title={`${PRODUCT_PACKAGE_NAMES.standardTrial} Terms`}
      intro={`Draft trial terms for ${PRODUCT_PACKAGE_NAMES.standardTrial}, the planned V1.2 commercial trial packaging.`}
      sections={[
        {
          title: "Trial packaging",
          body: [
            `${PRODUCT_PACKAGE_NAMES.standardTrial} is a display and packaging name for the planned V1.2 commercial trial experience.`,
            `${PRODUCT_PACKAGE_NAMES.standard} is the corresponding Standard package display name.`,
          ],
        },
        {
          title: "Server-owned trial state",
          body: [
            "Actual trial status, trial dates, credits, usage, access, and account limits are governed by server-owned account state and deterministic application logic.",
            "This page does not change trial duration, credit grants, plan-code assignment, access enforcement, or billing behavior.",
          ],
        },
        {
          title: "Plan-code boundary",
          body: [
            "This draft does not claim that standard_trial_v1 is currently assigned to new accounts.",
            "Existing trial_v1 behavior remains separate until a later scoped billing or trial branch changes server-owned behavior.",
          ],
        },
      ]}
    />
  );
}

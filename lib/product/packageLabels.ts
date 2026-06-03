// V1.2 packaging labels and plan-code identifiers.
// These constants are display/planning oriented for now; billing behavior still
// lives in the existing billing modules until a later scoped branch wires this in.

export const PRODUCT_NAME = "Release Signal";

export const PRODUCT_PACKAGE_LABELS = {
  basePlan: "Standard",
  trial: "Standard Trial",
  internalRelease: "v1.2",
} as const;

export const PRODUCT_PACKAGE_NAMES = {
  standard: "Release Signal Standard",
  standardTrial: "Release Signal Standard Trial",
} as const;

export const PRODUCT_PLAN_CODES = {
  legacyTrial: "trial_v1",
  standardTrial: "standard_trial_v1",
  standardPaid: "standard_v1",
} as const;

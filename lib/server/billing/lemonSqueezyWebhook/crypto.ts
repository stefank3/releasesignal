import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type RawBody = string | Uint8Array;

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function sha256Hex(rawBody: RawBody): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function verifyLemonSqueezySignature(args: {
  rawBody: RawBody;
  signature: string | null | undefined;
  secret: string | null | undefined;
}):
  | { ok: true }
  | {
      ok: false;
      reason:
        | "configuration_error"
        | "signature_missing"
        | "signature_malformed"
        | "signature_invalid";
    } {
  if (!args.secret?.trim()) return { ok: false, reason: "configuration_error" };
  if (args.signature === null || args.signature === undefined || args.signature === "") {
    return { ok: false, reason: "signature_missing" };
  }
  if (!SHA256_HEX_PATTERN.test(args.signature)) {
    return { ok: false, reason: "signature_malformed" };
  }

  const calculated = Buffer.from(
    createHmac("sha256", args.secret).update(args.rawBody).digest("hex"),
    "hex"
  );
  const received = Buffer.from(args.signature, "hex");

  // timingSafeEqual throws for unequal lengths, so format and length checks
  // must occur before comparison at this trust boundary.
  if (calculated.length !== received.length || !timingSafeEqual(calculated, received)) {
    return { ok: false, reason: "signature_invalid" };
  }

  return { ok: true };
}

// /lib/openai.ts
import "server-only";

import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Central OpenAI client.
 * - Server-only
 * - Uses validated env vars (Step 2)
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

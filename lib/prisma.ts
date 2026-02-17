// /lib/prisma.ts
import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "@/lib/env";

type GlobalForPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const g = globalThis as GlobalForPrisma;

function sslConfig() {
  // Supabase hosted envs typically require SSL.
  // Locally you might not need it.
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;
}

function getPool(): Pool {
  if (g.pgPool) return g.pgPool;

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: sslConfig(),
  });

  // Cache pool/client in dev to avoid exhausting connections via HMR
  if (process.env.NODE_ENV !== "production") g.pgPool = pool;
  return pool;
}

function getPrisma(): PrismaClient {
  if (g.prisma) return g.prisma;

  const client = new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: ["error", "warn"],
  });

  if (process.env.NODE_ENV !== "production") g.prisma = client;
  return client;
}

export const prisma = getPrisma();

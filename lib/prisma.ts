// /lib/prisma.ts
// Central Prisma entry point for all server-side database access.
//
// M11 NOTE:
// Telemetry persistence should use this same shared Prisma client.
// Do not create a separate Prisma client inside telemetry modules.
//
// Why this file matters:
// - keeps connection handling centralized
// - avoids hot-reload connection explosions in dev
// - ensures all server modules use the same adapter/pool path
//
// Prisma 7 compatible setup using:
// - @prisma/client
// - @prisma/adapter-pg
// - pg Pool

import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "@/lib/env";

// Global cache shape used only in-process.
// This prevents repeated Prisma / pg Pool instantiation during dev HMR.
type GlobalForPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const g = globalThis as GlobalForPrisma;

function sslConfig() {
  // Supabase hosted environments usually require SSL.
  // Local development often does not.
  //
  // We keep this isolated in one helper so SSL behavior stays explicit
  // and easy to adjust later if deployment requirements change.
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;
}

function getPool(): Pool {
  // Reuse cached pool when available.
  if (g.pgPool) return g.pgPool;

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: sslConfig(),
  });

  // In development, cache the pool globally to avoid exhausting
  // database connections during hot module reloads.
  if (process.env.NODE_ENV !== "production") g.pgPool = pool;

  return pool;
}

function getPrisma(): PrismaClient {
  // Reuse cached Prisma client when available.
  if (g.prisma) return g.prisma;

  const client = new PrismaClient({
    // Prisma 7 adapter-based Postgres connection path.
    adapter: new PrismaPg(getPool()),

    // Keep logs conservative in app runtime.
    // Enough for operational visibility without over-noising output.
    log: ["error", "warn"],
  });

  // In development, cache the Prisma client globally to avoid
  // duplicate client creation on file reload.
  if (process.env.NODE_ENV !== "production") g.prisma = client;

  return client;
}

// Shared singleton Prisma client for the full server application.
// M11 telemetry service should import and use this instance.
export const prisma = getPrisma();
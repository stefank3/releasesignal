import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GlobalForPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const g = globalThis as GlobalForPrisma;

function getConnectionString(): string {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("Missing DATABASE_URL env var");
  return cs;
}

function sslConfig() {
  // Good default: SSL in hosted envs, not forced locally
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;
}

function getPool(): Pool {
  if (g.pgPool) return g.pgPool;

  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: sslConfig(),
  });

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

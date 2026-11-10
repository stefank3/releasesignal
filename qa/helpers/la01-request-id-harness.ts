import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createContext, Script } from 'node:vm';
import ts from 'typescript';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const root = path.resolve(__dirname, '../..');
const nativeRequire = createRequire(path.join(root, 'package.json'));
export const baseline = '5e6fc70b005c14f039d4595cf1c31db1af02f898';
const project = 'qrqasyfepnawtjcwntnq';
const stamp = '2030-01-01T00:00:00.000Z';

export const artifact = {
  refinedRequirement: {
    version: 1, objective: 'An authenticated user can reset a password with a single-use token.',
    functionalScope: ['Request a reset token', 'Reset a password'],
    businessRules: ['A reset token is single-use.'],
    acceptanceCriteria: ['A valid token resets the password.'],
    edgeCases: ['Reject an expired token'], lastUpdatedAt: stamp,
  },
  testSuite: {
    version: 1, basedOnRequirementVersion: 1, createdAt: stamp, lastUpdatedAt: stamp,
    cases: [{ id: 'LA01-CASE-1', title: 'Reset password with a valid token',
      body: 'Use a valid token. Expect the password to change.', type: 'API', priority: 'P1',
      preconditions: ['An authenticated user has a valid token'],
      steps: ['Submit the token and a new password'], expectedResults: ['Password changes'] }],
  },
};
export const executionPayload = JSON.stringify({ source: 'manual', suiteVersion: 1,
  observedAt: stamp, suiteStatus: 'passed', caseResults: [
    { caseId: 'LA01-CASE-1', status: 'passed', observedAt: stamp, source: 'manual' },
  ] });
const modelReply = JSON.stringify({ explanationText: 'Synthetic explanation only.',
  objective: artifact.refinedRequirement.objective,
  functionalScope: artifact.refinedRequirement.functionalScope,
  businessRules: artifact.refinedRequirement.businessRules,
  acceptanceCriteria: artifact.refinedRequirement.acceptanceCriteria,
  assumptions: [], riskMatrix: [], optionalClarifications: [],
  highSignalApproach: { goals: ['Verify password reset'], testIdeas: ['Reject expired tokens'] },
});

export function bodyFor(kind: 'ordinary' | 'explicit' | 'ingestion', sessionId: string) {
  if (kind === 'ingestion') return { sessionId, mode: 'coach', action: 'ingest_execution_results', message: executionPayload };
  if (kind === 'explicit') return { sessionId, mode: 'review', action: 'review_test_suite' };
  return { sessionId, mode: 'review', message: 'Review the persisted password reset test suite.' };
}

export function gate() {
  let entered!: () => void, release!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release, block: async () => { entered(); await released; } };
}
type CallContext = { subject: string; gate?: ReturnType<typeof gate>; gated?: boolean;
  zeroUsage?: boolean; model: number; repair: number; repairReply?: string };

function approvedConnection(): string {
  const raw = process.env.LA01_TEST_DATABASE_URL;
  if (!raw) throw new Error('LA01_TEST_DATABASE_URL missing');
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Invalid test connection; value withheld'); }
  // Reject URL overrides that could redirect pg away from the approved project.
  const params = [...u.searchParams.keys()];
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || u.pathname !== '/postgres' ||
      (u.port || '5432') !== '5432' || params.some(k => k !== 'sslmode') ||
      !((u.hostname === `db.${project}.supabase.co` && decodeURIComponent(u.username) === 'postgres') ||
        (/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(u.hostname) &&
          decodeURIComponent(u.username) === `postgres.${project}`))) {
    throw new Error('Database target is not the approved LA-01 project');
  }
  return raw;
}

function schemaShape(file: string) {
  // Prisma generation reformats alignment and reorders index declarations.
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '').replace(/\s/g, ''))
    .filter(Boolean).sort().join('\n');
}

export async function openHarness() {
  const connectionString = approvedConnection();
  const pool = new Pool({ connectionString, max: 6, connectionTimeoutMillis: 10_000 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  try {
    const identity = await pool.query('SELECT current_database() AS database, inet_server_addr()::text AS address');
    if (identity.rows[0].database !== 'postgres') throw new Error('Unexpected database identity');
    const indexes = await pool.query(`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname='public'`);
    for (const [table, fields] of [
      ['CreditWallet', '(organizationId,currency)'],
      ['CreditLedger', '(walletId,reason,requestId)'],
      ['ChatSession', '(auth0Sub,clientSessionId)'],
      ['ChatMessage', '(sessionId,requestId,role)'],
    ]) {
      if (!indexes.rows.some(r => r.tablename === table && /CREATE UNIQUE INDEX/.test(r.indexdef) &&
          r.indexdef.replace(/["\s]/g, '').endsWith(fields))) throw new Error(`Missing idempotency index: ${table}`);
    }
    const migrations = await pool.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"');
    const dirs = fs.readdirSync(path.join(root, 'prisma/migrations')).filter(n => /^\d/.test(n));
    for (const name of dirs) {
      const checksum = createHash('sha256').update(fs.readFileSync(path.join(root, 'prisma/migrations', name, 'migration.sql'))).digest('hex');
      if (!migrations.rows.some(r => r.migration_name === name && r.checksum === checksum && r.finished_at && !r.rolled_back_at)) {
        throw new Error('Checked-in migration history mismatch');
      }
    }
    if (schemaShape(path.join(root, 'prisma/schema.prisma')) !== schemaShape(path.join(root, 'node_modules/.prisma/client/schema.prisma'))) {
      throw new Error('Generated Prisma schema differs from the repository');
    }
    if (process.env.LA01_TEST_PHASE === 'baseline') {
      const original = execFileSync('git', ['show', `${baseline}:app/api/chat/route.ts`], { cwd: root, encoding: 'utf8' });
      if (original.replace(/\r\n/g, '\n') !== fs.readFileSync(path.join(root, 'app/api/chat/route.ts'), 'utf8').replace(/\r\n/g, '\n')) {
        throw new Error('Baseline reproduction requires the untouched baseline route');
      }
    }
    console.info(JSON.stringify({ preflight: 'verified', project, database: 'postgres',
      migrationCount: dirs.length, idempotencyIndexes: 4, generatedSchema: 'equivalent', baseline }));
  } catch (error) {
    await db.$disconnect(); await pool.end();
    // Do not expose driver diagnostics containing connection metadata.
    throw new Error('LA-01 database/schema preflight failed: ' +
      (error instanceof Error && /^(Unexpected|Missing idempotency|Checked-in|Generated|Baseline)/.test(error.message)
        ? error.message : 'connection or schema verification failed; details withheld'));
  }

  const run = `la01-${randomUUID()}`;
  const subjects = [`${run}-owner`, `${run}-member`, `${run}-independent`];
  const orgs = [`${run}-org-a`, `${run}-org-b`];
  const wallets = [`${run}-wallet-a`, `${run}-wallet-b`];
  const sessions = [`${run}-session-a`, `${run}-session-b`, `${run}-session-c`, `${run}-session-d`];
  const context = new AsyncLocalStorage<CallContext>();
  const counters = { model: 0, repair: 0 };
  const metrics: Array<{ status: number }> = [];
  const errors: string[] = [];
  const cache = new Map<string, { exports: any }>();
  const loaded = new Set<string>();
  const syntheticEnv = Object.fromEntries(['DATABASE_URL','DIRECT_URL','AUTH0_DOMAIN','AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET','AUTH0_SECRET','APP_BASE_URL','UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN','OPENAI_API_KEY'].map(name => [name, 'synthetic-not-a-credential']));
  const sandbox = createContext({ Buffer, URL, Request, Response, Headers, Date, Error, Set, Map,
    TextEncoder, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    process: { env: { ...syntheticEnv, NODE_ENV: 'test' } },
    console: { log() {}, info() {}, warn() {}, error() {} },
    fetch: () => { throw new Error('External fetch prohibited in LA-01'); },
  });
  const external = new Set(['crypto', 'node:crypto', '@prisma/client', 'next/server']);

  function load(file: string): any {
    if (!file.startsWith(root + path.sep)) throw new Error('Module escaped repository');
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} as any };
    cache.set(file, module);
    loaded.add(path.relative(root, file).replaceAll('\\', '/'));
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, fileName: file }).outputText;
    function localRequire(name: string): any {
      if (name === 'server-only') return {};
      if (name === '@/lib/prisma') return { prisma: db };
      if (name === '@/lib/auth0') return { auth0: {
        getSession: async () => ({ user: { sub: context.getStore()!.subject } }),
        getAccessToken: async () => ({ token: '' }),
      } };
      if (name === 'next/headers') return { cookies: async () => ({ get: () => undefined, delete() {} }) };
      if (name === '@/lib/ratelimit') return { CHAT_RATE_LIMIT: { limit: 1000 },
        chatRatelimit: { limit: async () => ({ success: true, remaining: 999, reset: Date.now() + 60000 }) } };
      if (name === '@/lib/redis') return { key: (value: string) => value,
        redis: new Proxy({}, { get: () => () => { throw new Error('Unexpected Redis access'); } }) };
      if (name === '@/lib/logger') return { log: (_level: string, data: any) => {
        if (data.errorType) errors.push(String(data.errorType));
      } };
      if (name === '@/lib/metrics/chatMetrics') return { recordChatMetric: async (m: any) => { metrics.push({ status: m.status }); } };
      if (name === '@/lib/server/telemetry/telemetryService') return { emitTelemetryEvent: async () => {} };
      if (name === 'openai') return class ForbiddenOpenAI {
        constructor() { /* Construction only; provider calls use the controlled adapter. */ }
      };
      if (name === '@/lib/ai/providers/openaiProvider') return { executeOpenAIRequest: async (request: any) => {
        const state = context.getStore();
        if (!state) throw new Error('Provider call outside controlled request');
        const repair = request.messages.some((m: any) => m.role === 'user' && m.content.startsWith('Fix this into valid JSON only:'));
        const key = repair ? 'repair' : 'model'; counters[key]++; state[key]++;
        if (state.gate && !state.gated) { state.gated = true; await state.gate.block(); }
        return { rawReply: repair ? state.repairReply ?? modelReply : modelReply,
          usage: { promptTokens: state.zeroUsage ? 0 : 10, completionTokens: state.zeroUsage ? 0 : 10, totalTokens: state.zeroUsage ? 0 : 20 },
          model: 'gpt-4.1-mini', provider: 'openai', providerLatencyMs: 0 };
      } };
      if (external.has(name)) return nativeRequire(name);
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        const resolved = [base + '.ts', path.join(base, 'index.ts')].find(p => fs.existsSync(p));
        if (resolved) return load(resolved);
      }
      throw new Error(`Unapproved harness dependency: ${name}`);
    }
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file })
      .runInContext(sandbox)(localRequire, module, module.exports);
    return module.exports;
  }

  let post: (request: Request) => Promise<Response>;
  try {
    post = load(path.join(root, 'app/api/chat/route.ts')).POST;
    // No DB mocks: assert that the actual protected source modules were loaded.
    for (const file of ['lib/chat/persist.ts', 'lib/chat/sessionStore.ts', 'lib/billing/chargeCredits.ts',
      'lib/billing/resolveOrgForUser.ts', 'lib/billing/accountAccess.ts', 'lib/server/chat/replayService.ts']) {
      if (!loaded.has(file)) throw new Error(`Real module missing: ${file}`);
    }
    await db.$transaction(async tx => {
      for (let i = 0; i < 2; i++) {
        await tx.organization.create({ data: { id: orgs[i], name: `Synthetic LA-01 ${i}` } });
        await tx.orgMember.create({ data: { organizationId: orgs[i], auth0Sub: subjects[i === 0 ? 0 : 2], role: 'member' } });
        await tx.subscription.create({ data: { organizationId: orgs[i], status: 'trialing', planCode: 'trial_v1',
          seats: 1, monthlyCredits: 100, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) } });
        await tx.creditWallet.create({ data: { id: wallets[i], organizationId: orgs[i], currency: 'credits', balance: 100 } });
        await tx.creditLedger.create({ data: { walletId: wallets[i], auth0Sub: subjects[i === 0 ? 0 : 2],
          reason: 'la01_synthetic_grant', requestId: `${run}-grant-${i}`, delta: 100 } });
      }
      await tx.orgMember.create({ data: { organizationId: orgs[0], auth0Sub: subjects[1], role: 'member' } });
      for (let i = 0; i < 4; i++) await tx.chatSession.create({ data: { id: sessions[i],
        auth0Sub: subjects[i < 2 ? 0 : i === 2 ? 1 : 2], mode: 'review', artifactJson: artifact } });
    }, { timeout: 30000 });
  } catch (error) { await db.$disconnect(); await pool.end(); throw error; }

  return {
    db, subjects, orgs, wallets, sessions, counters, metrics, errors,
    requestId: () => randomUUID(),
    async call(subject: string, id: string, body: Record<string, unknown>, options: Partial<CallContext> = {}) {
      const state: CallContext = { ...options, subject, model: 0, repair: 0 };
      return context.run(state, async () => {
        const response = await post(new Request('http://la01.invalid/api/chat', { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-request-id': id }, body: JSON.stringify(body) }));
        return { status: response.status, body: await response.json(), model: state.model, repair: state.repair,
          requestId: response.headers.get('x-request-id') };
      });
    },
    async snapshot(id: string, wallet = wallets[0]) {
      return { balance: (await db.creditWallet.findUniqueOrThrow({ where: { id: wallet } })).balance,
        debits: await db.creditLedger.count({ where: { walletId: wallet, requestId: id, reason: 'chat_usage' } }),
        assistants: await db.chatMessage.count({ where: { requestId: id, role: 'assistant', auth0Sub: { in: subjects } } }) };
    },
    async close() {
      try {
        // Only exact IDs/subjects created by this run; never wipe shared tables.
        await db.chatSession.deleteMany({ where: { auth0Sub: { in: subjects } } });
        await db.organization.deleteMany({ where: { id: { in: orgs } } });
      } finally { await db.$disconnect(); await pool.end(); }
    },
  };
}
export type Harness = Awaited<ReturnType<typeof openHarness>>;

import { createServer } from "node:http";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(repository, "qa/test-results");
const hostname = "127.0.0.1";
const port = 3109;
const origin = `http://${hostname}:${port}`;
const sourcePath = (relative) => JSON.stringify(path.join(repository, relative).replaceAll("\\", "/"));

function ownedDirectory(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== output || !/^pr9-fixture-[a-zA-Z0-9]+$/.test(path.basename(resolved))) {
    throw new Error("Refusing to access a directory outside this fixture run");
  }
  return resolved;
}

function reportError(context, error) {
  let detail = error instanceof Error ? error.stack ?? error.message : String(error);
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length > 3 && /secret|token|password|key|database_url|run_id/i.test(name)) {
      detail = detail.replaceAll(value, "[redacted]");
    }
  }
  console.error(`[PR9 fixture] ${context}: ${detail}`);
}

// Playwright's Windows webServer teardown force-kills processes. This hook
// requests an owned, graceful shutdown before that fallback runs.
export default async function teardown() {
  const response = await fetch(`${origin}/shutdown`, {
    method: "POST",
    headers: { "x-pr9-run-id": process.env.PR9_FIXTURE_RUN_ID ?? "" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 202) throw new Error(`Fixture shutdown failed: HTTP ${response.status}`);
  const { directory } = await response.json();
  const target = ownedDirectory(directory);
  for (let attempt = 0; attempt < 120; attempt++) {
    try { await access(target); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      console.log(`[PR9 fixture] Owned directory removed: ${path.basename(target)}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Fixture shutdown did not remove its owned directory within 30 seconds");
}

async function start() {
  const runId = process.env.PR9_FIXTURE_RUN_ID || randomUUID();
  let directory;
  let application;
  let server;
  let ready = false;
  let closing;
  const sockets = new Set();

  function close() {
    closing ??= (async () => {
      ready = false;
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          for (const socket of sockets) socket.destroy();
        });
      }
      await application?.close();
      // Validate the exact mkdtemp result; never enumerate/delete sibling runs.
      // Finish deletion synchronously before process exit, so queued dev-watch
      // callbacks cannot run against a partly removed fixture application.
      if (directory) rmSync(ownedDirectory(directory), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    })();
    return closing;
  }

  async function shutdown() {
    try { await close(); process.exit(0); } catch (error) {
      reportError("Shutdown failed", error);
      process.exit(1);
    }
  }

  try {
    await mkdir(output, { recursive: true });
    directory = await mkdtemp(path.join(output, "pr9-fixture-"));
    console.log(`[PR9 fixture] Owned directory: ${path.basename(directory)}`);
    await mkdir(path.join(directory, "app"));

    // Generate synthetic records only inside ignored output, never in the public source.
    const approved = Array.from({ length: 3 }, (_, index) => ({
      id: `fixture-${index + 1}`,
      quote: `Fixture quote ${index + 1}. ` + "Full review content. ".repeat(index === 1 ? 25 : 2),
      authorName: `Fixture author ${index + 1}` + (index === 1 ? "X".repeat(90) : ""),
      ...(index === 1 ? { authorRole: "Role".repeat(30), company: "Company".repeat(30) } : {}),
      approvedForPublication: true,
    }));
    const rejected = [false, "true", 1, null].map((approval, index) => ({
      ...approved[0], id: `rejected-${index}`, quote: `Rejected fixture ${index}`,
      approvedForPublication: approval,
    }));
    const scenarios = { zero: [], one: approved.slice(0, 1), multiple: approved,
      mixed: [rejected[0], approved[0], rejected[1], approved[1], ...rejected.slice(2)],
      rejected };

    await writeFile(path.join(directory, "candidates.json"), JSON.stringify(scenarios));
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true }));
    await writeFile(path.join(directory, "next.config.mjs"),
      `export default { devIndicators: false, outputFileTracingRoot: ${JSON.stringify(repository)} };\n`);
    await writeFile(path.join(directory, "app/fixture.css"), `
    .pr9Fixture, .pr9Fixture *, .pr9Fixture::before, .pr9Fixture::after,
    .pr9Fixture *::before, .pr9Fixture *::after { box-sizing: border-box; }
    `);
    await writeFile(path.join(directory, "app/layout.jsx"), `
    import "./fixture.css";
    export default function Layout({ children }) {
      return <html lang="en"><body className="pr9Fixture" style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>{children}</body></html>;
    }
    `);
    await writeFile(path.join(directory, "app/page.jsx"), `
    import { LandingReviewSection } from ${sourcePath("app/components/marketing/LandingReviewSection.tsx")};
    import { getApprovedPublicReviews } from ${sourcePath("app/reviews/publicReviews.ts")};
    import marketing from ${sourcePath("app/components/marketing/MarketingShell.module.css")};
    import scenarios from "../candidates.json";
    export default async function Page({ searchParams }) {
      const { scenario = "zero" } = await searchParams;
      const reviews = getApprovedPublicReviews(scenarios[scenario] ?? []);
      return <div className={marketing.page}><main>
        <div data-testid="before">Before</div>
        <LandingReviewSection reviews={reviews} />
        <div data-testid="after">After</div>
      </main></div>;
    }
    `);

    application = next({ dev: true, webpack: true, dir: directory, hostname, port });
    server = createServer((request, response) => {
      if (request.url === "/health") {
        response.writeHead(ready ? 200 : 503).end(ready ? "PR9 fixture rendered" : "PR9 fixture starting");
        return;
      }
      if (request.url === "/shutdown" && request.method === "POST") {
        if (request.headers["x-pr9-run-id"] !== runId) {
          response.writeHead(403).end("Not this fixture run");
          return;
        }
        response.once("finish", () => { void shutdown(); });
        response.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ directory }));
        return;
      }
      application.getRequestHandler()(request, response).catch((error) => {
        reportError("Render failed", error);
        if (!response.headersSent) response.writeHead(500);
        response.end("Fixture render failed");
      });
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => { void shutdown(); });
    }
    await application.prepare();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, hostname, resolve);
    });
    // Probe the real page once, not /health. Readiness cannot precede its render,
    // and a failed/slow render fails startup rather than entering a retry loop.
    const rendered = await fetch(`${origin}/?scenario=multiple`, { signal: AbortSignal.timeout(60_000) });
    const html = await rendered.text();
    if (rendered.status !== 200 || !html.includes("Fixture quote 1.") || !html.includes("Customer reviews")) {
      throw new Error(`Fixture warm-up failed: HTTP ${rendered.status}; expected review content missing`);
    }
    ready = true;
    console.log(`[PR9 fixture] Rendered and ready at ${origin}`);
  } catch (error) {
    reportError("Startup failed", error);
    try { await close(); } catch (cleanupError) { reportError("Startup cleanup failed", cleanupError); }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await start();

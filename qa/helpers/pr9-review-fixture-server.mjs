import { createServer } from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(repository, "qa/test-results");
await mkdir(output, { recursive: true });
const directory = await mkdtemp(path.join(output, "pr9-fixture-"));
await mkdir(path.join(directory, "app"));
const sourcePath = (relative) => JSON.stringify(path.join(repository, relative).replaceAll("\\", "/"));

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
await writeFile(path.join(directory, "app/layout.jsx"), `
export default function Layout({ children }) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>{children}</body></html>;
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

const hostname = "127.0.0.1";
const port = 3109;
const application = next({ dev: true, webpack: true, dir: directory, hostname, port });
const sockets = new Set();
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200).end("PR9 fixture server");
    return;
  }
  application.getRequestHandler()(request, response).catch((error) => {
    console.error(error);
    response.writeHead(500).end("Fixture render failed");
  });
});
server.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close();
  for (const socket of sockets) socket.destroy();
  await application.close();
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { void close().then(() => process.exit(0)); });
}
try {
  await application.prepare();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });
  console.log(`PR9 fixtures listening at http://${hostname}:${port}`);
} catch (error) {
  await close();
  throw error;
}

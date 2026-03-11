// lib/server/chat/casesFlowService.ts
// M10 Pass 9
// Extract cases-mode orchestration from route.ts so the API route
// stays focused on orchestration only.

import type { SessionArtifact, TestSuiteArtifact } from "@/lib/chat/artifact";
import { getTestSuite } from "@/lib/chat/artifact";

import {
  mergeGeneratedCasesIntoSuite,
  renderTestSuiteForUser,
} from "@/lib/server/chat/testSuiteService";

export async function runCasesFlow(args: {
  rawReply: string;
  sessionArtifact: SessionArtifact | null;
  explicitRegenerationRequest: boolean;
}): Promise<{
  replyTextForUser: string;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
  testSuiteAddedCount: number;
}> {
  const existingSuiteForMerge = args.explicitRegenerationRequest
    ? null
    : getTestSuite(args.sessionArtifact);

  const merged = mergeGeneratedCasesIntoSuite({
    existingSuite: existingSuiteForMerge,
    generatedText: args.rawReply.trim(),
    explicitReset: args.explicitRegenerationRequest,
  });

  const nextTestSuiteArtifact = merged.nextSuite;
  const testSuiteAddedCount = merged.addedCount;

  const replyTextForUser = nextTestSuiteArtifact
    ? renderTestSuiteForUser(nextTestSuiteArtifact)
    : args.rawReply.trim();

  return {
    replyTextForUser,
    nextTestSuiteArtifact,
    testSuiteAddedCount,
  };
}
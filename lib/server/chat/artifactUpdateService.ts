// lib/server/chat/artifactUpdateService.ts
// M10 Pass 11
// Centralize small artifact update workflows so route.ts no longer owns
// raw artifact patching / persistence details.
//
// SURGICAL CHANGE:
// - extract guided-answer artifact patching
// - extract persisted suite artifact writes after Cases flow

import {
  type SessionArtifact,
  type TestSuiteArtifact,
  mergeArtifact,
  parseGuidedAnswerToRefinedRequirement,
} from "@/lib/chat/artifact";

import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";
import { withUpdatedTestSuiteArtifact } from "@/lib/server/chat/testSuiteService";

export async function applyGuidedArtifactPatch(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  guidedAnswer: boolean;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.guidedAnswer) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const patch = parseGuidedAnswerToRefinedRequirement(args.message);

  if (!patch) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const nextArtifact = mergeArtifact(args.sessionArtifact, patch);

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
  };
}

export async function persistGeneratedSuiteArtifact(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.nextTestSuiteArtifact) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const nextArtifact = withUpdatedTestSuiteArtifact(
    args.sessionArtifact,
    args.nextTestSuiteArtifact
  );

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
  };
}
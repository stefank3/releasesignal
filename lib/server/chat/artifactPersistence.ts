// lib/server/chat/artifactPersistence.ts
// M10 extraction:
// Centralize session artifact persistence updates so route.ts
// does not repeat raw Prisma update blocks.

import { prisma } from "@/lib/prisma";
import { prismaJsonValue, type SessionArtifact } from "@/lib/chat/artifact";

export async function saveSessionArtifact(args: {
  sessionId: string;
  artifact: SessionArtifact;
}): Promise<{ artifact: SessionArtifact; artifactUpdatedAtIso: string }> {
  const now = new Date();

  await prisma.chatSession.update({
    where: { id: args.sessionId },
    data: {
      artifactJson: prismaJsonValue(args.artifact),
      artifactUpdatedAt: now,
    },
    select: { id: true },
  });

  return {
    artifact: args.artifact,
    artifactUpdatedAtIso: now.toISOString(),
  };
}
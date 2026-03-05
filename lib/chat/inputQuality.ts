// lib/chat/inputQuality.ts
export function isWeakInput(message: string): boolean {
  const t = message.trim();
  if (t.length < 60) return true;

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount < 12) return true;

  const hasPunct = /[.?!:;]/.test(t);
  if (!hasPunct && t.length < 120) return true;

  return false;
}
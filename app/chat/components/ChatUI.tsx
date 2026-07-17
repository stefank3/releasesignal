// app/chat/components/ChatUI.tsx

"use client";

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

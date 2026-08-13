/**
 * API authentication — single shared API key (Bearer token).
 * GET routes are public; all write routes call requireApiAuth().
 * Rotatable via env (no DB change). Future: per-token table if needed.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Returns true if the request carries a valid Bearer token. */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.AUTH_API_KEY;
  if (!expected) return false; // no key configured = no access
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  return safeEqual(token, expected);
}

/** Throws-safe 401 response helper. */
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized — provide a valid Authorization: Bearer <key> header." },
    { status: 401 },
  );
}

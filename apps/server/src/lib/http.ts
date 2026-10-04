import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { badRequest, errorResponse } from "./errors";
import { env } from "./env";

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj);
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response> | Response;

/** Wrap a route handler with uniform error handling, CORS and no-store caching. */
export function route<Ctx = { params: Promise<Record<string, string>> }>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      const res = await handler(req, ctx);
      return withCors(req, res);
    } catch (err) {
      return withCors(req, errorResponse(err));
    }
  };
}

const STATIC_ORIGINS = new Set([
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "ionic://localhost",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
]);

/** Origins named explicitly (static list, CORS_ORIGINS entries, APP_PUBLIC_URL). Only these may send cookies cross-origin. */
export function trustedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ORIGINS.has(origin)) return true;
  const extra = env().CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (extra.includes(origin)) return true;
  const pub = env().APP_PUBLIC_URL;
  return Boolean(pub && origin === new URL(pub).origin);
}

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (trustedOrigin(origin)) return origin;
  const extra = env().CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (extra.includes("*")) return origin;
  // Preview deployments of the admin panel on Vercel (bearer tokens only — see withCors).
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin;
  return null;
}

export function withCors(req: NextRequest, res: Response): Response {
  const requested = req.headers.get("origin");
  const origin = allowedOrigin(requested);
  const headers = new Headers(res.headers);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    // Wildcard matches (`*`, any *.vercel.app) never get credentials: an attacker-controlled
    // origin must not be able to ride on the admin cookie. Mobile uses bearer tokens anyway.
    if (trustedOrigin(requested)) headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-App-Version,X-Device-Id");
  headers.set("Access-Control-Max-Age", "86400");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function preflight(req: NextRequest): Response {
  return withCors(req, new Response(null, { status: 204 }));
}

/** Every API route exports this so browsers can preflight cross-origin calls. */
export const OPTIONS = (req: NextRequest) => preflight(req);

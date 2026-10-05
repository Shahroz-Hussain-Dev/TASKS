import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TTL_SECONDS } from "@/lib/auth";
import { isProd } from "@/lib/env";

/** HttpOnly cookie carrying the admin panel's access token (read by `requireAuth`). */
export const ADMIN_COOKIE = "raahi_admin";

function isSecureContext(req: NextRequest): boolean {
  return isProd() || req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export function setAdminCookie(res: NextResponse, req: NextRequest, accessToken: string): void {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: isSecureContext(req),
    sameSite: "lax",
    maxAge: ACCESS_TTL_SECONDS,
    path: "/",
  });
}

export function clearAdminCookie(res: NextResponse, req: NextRequest): void {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: isSecureContext(req),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

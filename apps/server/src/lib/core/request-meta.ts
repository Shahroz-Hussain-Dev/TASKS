import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/http";

export interface RequestMeta {
  userAgent: string | null;
  ip: string;
}

/** Client fingerprint stored with every session row and audit entry. */
export function requestMeta(req: NextRequest): RequestMeta {
  return { userAgent: req.headers.get("user-agent"), ip: clientIp(req) };
}

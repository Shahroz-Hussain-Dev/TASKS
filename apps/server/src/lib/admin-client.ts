/**
 * Browser-side client for the admin panel. Same-origin, cookie-authenticated
 * (`raahi_admin` HttpOnly cookie set by POST /api/auth/admin/login).
 *
 * Every call resolves to the parsed JSON body or throws an {@link AdminApiError}
 * carrying `{ status, code, message }`. A 401 anywhere except the login call
 * sends the browser to /admin/login — the session has expired.
 */
import type {
  AdminStatsDto,
  AuthTokens,
  DocumentDto,
  DriverDto,
  FareBreakdown,
  Paginated,
  PlatformSettings,
  RideDto,
  RideRequestDto,
  SubscriptionDto,
  SupportTicketDto,
  UserDto,
  VehicleCategory,
} from "@raahi/shared";

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isAdminApiError = (err: unknown): err is AdminApiError => err instanceof AdminApiError;

/** Human-readable message for any thrown value, for toasts. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isAdminApiError(err)) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const LOGIN_PATH = "/admin/login";

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Skip the automatic redirect to the login page on 401 (used by the login form and the auth probe). */
  noRedirect?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      credentials: "include",
      cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new AdminApiError(0, "network", "Can't reach the Raahi server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const errBody = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const code = errBody?.code ?? (res.status === 401 ? "unauthorized" : "http_error");
    const message = errBody?.message ?? (res.status === 401 ? "Your session has expired. Please sign in again." : `Request failed (${res.status})`);
    if (res.status === 401 && !opts.noRedirect && typeof window !== "undefined" && !window.location.pathname.startsWith(LOGIN_PATH)) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`${LOGIN_PATH}?next=${next}`);
    }
    throw new AdminApiError(res.status, code, message, errBody?.details);
  }

  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Response shapes specific to admin routes                            */
/* ------------------------------------------------------------------ */

export type AdminDriverItem = DriverDto & { user: UserDto };

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminDriverDetail extends AdminDriverItem {
  rides: RideDto[];
  audit: AuditLogDto[];
}

export type AdminSubscriptionItem = SubscriptionDto & { driver: { id: string; fullName: string; phone: string | null } };
export type AdminCustomerItem = UserDto & { rides: number };

export interface LiveDriver {
  id: string;
  fullName: string;
  lat: number;
  lng: number;
  heading: number | null;
  category: VehicleCategory | null;
  plate: string | null;
  isOnline: boolean;
  updatedAt: string;
  rideId: string | null;
}

export interface LiveBoard {
  rides: RideDto[];
  drivers: LiveDriver[];
  requests: RideRequestDto[];
  serverTime: string;
}

export interface MeResponse {
  user: UserDto;
  driver: DriverDto | null;
}

export type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
};

export type FarePreviewParams = {
  distanceKm: number;
  durationMin: number;
  category: VehicleCategory;
  petrolPricePkr?: number;
  kmPerLitre?: number;
  driverFlatPkr?: number;
  perMinutePkr?: number;
  recommendedFuelMultiplier?: number;
  maxFareMultiplier?: number;
};

export type DriverDecision = "approve" | "reject" | "suspend" | "reinstate";
export type SettingsPatch = Partial<Omit<PlatformSettings, "paymentInstructions" | "commissionPercent">> & {
  paymentInstructions?: Partial<PlatformSettings["paymentInstructions"]>;
};

/* ------------------------------------------------------------------ */
/* API surface                                                         */
/* ------------------------------------------------------------------ */

export const adminApi = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: UserDto; tokens: AuthTokens }>("/api/auth/admin/login", { method: "POST", body: { email, password }, noRedirect: true }),
    logout: () => request<{ ok: boolean }>("/api/auth/admin/logout", { method: "POST", noRedirect: true }),
    me: (signal?: AbortSignal) => request<MeResponse>("/api/me", { noRedirect: true, signal }),
  },
  stats: (signal?: AbortSignal) => request<AdminStatsDto>("/api/admin/stats", { signal }),
  drivers: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<AdminDriverItem>>("/api/admin/drivers", { query: params, signal }),
    get: (id: string, signal?: AbortSignal) => request<AdminDriverDetail>(`/api/admin/drivers/${id}`, { signal }),
    decide: (id: string, decision: DriverDecision, reason?: string) =>
      request<DriverDto>(`/api/admin/drivers/${id}/decision`, { method: "POST", body: { decision, reason } }),
  },
  documents: {
    decide: (id: string, status: "verified" | "rejected", note?: string) =>
      request<DocumentDto>(`/api/admin/documents/${id}/decision`, { method: "POST", body: { status, note } }),
    reverify: (id: string) => request<DocumentDto>(`/api/admin/documents/${id}/reverify`, { method: "POST" }),
  },
  subscriptions: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<AdminSubscriptionItem>>("/api/admin/subscriptions", { query: params, signal }),
    decide: (id: string, decision: "approve" | "reject", note?: string) =>
      request<SubscriptionDto>(`/api/admin/subscriptions/${id}/decision`, { method: "POST", body: { decision, note } }),
  },
  customers: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<AdminCustomerItem>>("/api/admin/customers", { query: params, signal }),
  },
  users: {
    action: (id: string, action: "block" | "unblock", reason?: string) =>
      request<UserDto>(`/api/admin/users/${id}/action`, { method: "POST", body: { action, reason } }),
  },
  rides: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<RideDto>>("/api/admin/rides", { query: params, signal }),
    live: (signal?: AbortSignal) => request<LiveBoard>("/api/admin/rides/live", { signal }),
  },
  requests: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<RideRequestDto>>("/api/admin/requests", { query: params, signal }),
  },
  settings: {
    get: (signal?: AbortSignal) => request<PlatformSettings>("/api/admin/settings", { signal }),
    update: (patch: SettingsPatch) => request<PlatformSettings>("/api/admin/settings", { method: "PUT", body: patch }),
  },
  fare: {
    preview: (params: FarePreviewParams, signal?: AbortSignal) => request<FareBreakdown>("/api/admin/fare/preview", { query: params, signal }),
  },
  support: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<SupportTicketDto>>("/api/admin/support", { query: params, signal }),
    reply: (id: string, body: string, resolve?: boolean) =>
      request<SupportTicketDto>(`/api/admin/support/${id}/reply`, { method: "POST", body: { body, resolve } }),
  },
  audit: {
    list: (params: ListParams, signal?: AbortSignal) => request<Paginated<AuditLogDto>>("/api/admin/audit", { query: params, signal }),
  },
};

/** URL of an uploaded image served with the same-origin admin cookie. */
export const fileUrl = (fileId: string) => `/api/files/${fileId}`;

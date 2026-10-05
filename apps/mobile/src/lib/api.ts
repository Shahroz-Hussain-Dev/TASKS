/**
 * Typed API client. Handles base URL, bearer tokens, silent refresh and
 * uniform error objects. Every endpoint in docs/API.md has a function here.
 */
import type {
  AdminStatsDto,
  AuthResponse,
  AuthTokens,
  BidDto,
  ChatMessageDto,
  DriverDto,
  DriverEarningsDto,
  DriverRequestFeedItem,
  NotificationDto,
  Paginated,
  PublicConfigDto,
  RideDto,
  RideRequestDto,
  RouteQuote,
  SupportTicketDto,
  UserDto,
  VehicleModel,
  LatLng,
  CreateRideRequestInput,
  VehicleUpsertInput,
  DriverDetailsInput,
  PlaceBidInput,
} from "@raahi/shared";
import { getApiBaseUrl } from "./config";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Tokens = AuthTokens | null;
let tokens: Tokens = null;
let onTokens: ((t: Tokens) => void) | null = null;
let refreshing: Promise<Tokens> | null = null;

export function setTokens(t: Tokens, persist = true) {
  tokens = t;
  if (persist) onTokens?.(t);
}
export function getTokens() {
  return tokens;
}
export function onTokensChange(cb: (t: Tokens) => void) {
  onTokens = cb;
}

async function refreshTokens(): Promise<Tokens> {
  if (!tokens?.refreshToken) return null;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
        });
        if (!res.ok) {
          setTokens(null);
          return null;
        }
        const data = (await res.json()) as { tokens: AuthTokens };
        setTokens(data.tokens);
        return data.tokens;
      } catch {
        return tokens;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  signal?: AbortSignal;
  raw?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retry = true): Promise<T> {
  const base = getApiBaseUrl();
  const url = new URL(`${base}${path}`, base || window.location.origin);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) if (v !== undefined) url.searchParams.set(k, String(v));
  // ngrok-skip-browser-warning: lets the app talk to a backend tunnelled through a free ngrok
  // domain (which otherwise answers browser-like clients with an HTML warning page).
  const headers: Record<string, string> = { Accept: "application/json", "X-App-Version": "1.0.0", "ngrok-skip-browser-warning": "1" };
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network", base ? "Can't reach Raahi servers. Check your internet, or the server address under Profile → Settings." : "Server address is not configured.");
  }

  if (res.status === 401 && retry && opts.auth !== false && tokens?.refreshToken) {
    const t = await refreshTokens();
    if (t) return request<T>(path, opts, false);
  }

  if (opts.raw) return res as unknown as T;

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiRequestError(res.status, e?.code ?? "http_error", e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */

export const api = {
  health: () => request<{ ok: boolean; db: boolean; time: string }>("/api/health", { auth: false }),
  config: () => request<PublicConfigDto>("/api/config", { auth: false }),
  vehicleCatalog: (category?: string) => request<{ items: VehicleModel[] }>("/api/vehicles/catalog", { auth: false, query: { category } }),

  geo: {
    search: (q: string, near?: LatLng | null, signal?: AbortSignal) =>
      request<{ items: { name: string; address: string; lat: number; lng: number; type: string }[] }>("/api/geo/search", {
        auth: false,
        query: { q, lat: near?.lat, lng: near?.lng, limit: 7 },
        signal,
      }),
    reverse: (p: LatLng) => request<{ name: string; address: string }>("/api/geo/reverse", { auth: false, query: { lat: p.lat, lng: p.lng } }),
  },

  auth: {
    signupCustomer: (body: { fullName: string; phone: string; email?: string; password: string }) => request<AuthResponse>("/api/auth/signup/customer", { body, auth: false }),
    signupDriver: (body: { fullName: string; phone: string; password: string }) => request<AuthResponse>("/api/auth/signup/driver", { body, auth: false }),
    login: (body: { phone: string; password: string; role: "customer" | "driver" }) => request<AuthResponse>("/api/auth/login", { body, auth: false }),
    logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  },

  me: {
    get: () => request<{ user: UserDto; driver: DriverDto | null }>("/api/me"),
    update: (body: { fullName?: string; email?: string; avatarFileId?: string | null }) => request<{ user: UserDto; driver: DriverDto | null }>("/api/me", { method: "PATCH", body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) => request<{ ok: boolean }>("/api/me/password", { body }),
    notifications: (page = 1) => request<Paginated<NotificationDto> & { unread: number }>("/api/me/notifications", { query: { page, pageSize: 30 } }),
    markRead: (ids?: string[]) => request<{ ok: boolean }>("/api/me/notifications/read", { body: { ids } }),
    deleteAccount: () => request<{ ok: boolean }>("/api/me", { method: "DELETE" }),
  },

  files: {
    upload: async (blob: Blob, kind: "avatar" | "document" | "receipt", filename = "upload.jpg") => {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", blob, filename);
      return request<{ file: { id: string; url: string; width: number; height: number; sizeBytes: number } }>("/api/files", { method: "POST", body: fd });
    },
    /** Absolute URL for an authenticated image; use with <AuthImage>. */
    url: (idOrUrl: string | null | undefined) => (idOrUrl ? `${getApiBaseUrl()}${idOrUrl.startsWith("/") ? idOrUrl : `/api/files/${idOrUrl}`}` : null),
  },

  rides: {
    quote: (body: { pickup: LatLng; dropoff: LatLng }) => request<RouteQuote>("/api/rides/quote", { body }),
    list: (page = 1, pageSize = 20) => request<Paginated<RideDto>>("/api/rides", { query: { page, pageSize } }),
    active: () => request<{ ride: RideDto | null }>("/api/rides/active"),
    get: (id: string, signal?: AbortSignal) => request<RideDto>(`/api/rides/${id}`, { signal }),
    arrived: (id: string) => request<RideDto>(`/api/rides/${id}/arrived`, { method: "POST" }),
    start: (id: string) => request<RideDto>(`/api/rides/${id}/start`, { method: "POST" }),
    complete: (id: string) => request<RideDto>(`/api/rides/${id}/complete`, { method: "POST" }),
    cancel: (id: string, body: { reason: string; details?: string }) => request<RideDto>(`/api/rides/${id}/cancel`, { body }),
    rate: (id: string, body: { stars: number; comment?: string; tags?: string[] }) => request<RideDto>(`/api/rides/${id}/rate`, { body }),
    messages: (id: string, signal?: AbortSignal) => request<{ items: ChatMessageDto[] }>(`/api/rides/${id}/messages`, { signal }),
    send: (id: string, body: string) => request<ChatMessageDto>(`/api/rides/${id}/messages`, { body: { body } }),
    trail: (id: string) => request<{ points: { lat: number; lng: number; heading: number | null; recordedAt: string }[] }>(`/api/rides/${id}/trail`),
  },

  requests: {
    create: (body: CreateRideRequestInput) => request<RideRequestDto>("/api/requests", { body }),
    active: (signal?: AbortSignal) => request<{ request: RideRequestDto | null; ride: RideDto | null }>("/api/requests/active", { signal }),
    get: (id: string, signal?: AbortSignal) => request<RideRequestDto>(`/api/requests/${id}`, { signal }),
    updateOffer: (id: string, offeredFarePkr: number) => request<RideRequestDto>(`/api/requests/${id}`, { method: "PATCH", body: { offeredFarePkr } }),
    cancel: (id: string, reason?: string) => request<RideRequestDto>(`/api/requests/${id}`, { method: "DELETE", body: { reason } }),
    accept: (id: string, bidId: string) => request<RideDto>(`/api/requests/${id}/accept`, { body: { bidId } }),
  },

  driver: {
    get: () => request<DriverDto>("/api/driver"),
    details: (body: DriverDetailsInput) => request<DriverDto>("/api/driver/details", { method: "PUT", body }),
    vehicle: (body: VehicleUpsertInput) => request<DriverDto>("/api/driver/vehicle", { method: "PUT", body }),
    attachDocument: (body: { type: string; fileId: string }) => request<DriverDto>("/api/driver/documents", { body }),
    subscription: (body: { fileId: string; method: string; transactionRef?: string; amountPkr: number }) => request<DriverDto>("/api/driver/subscription", { body }),
    /** Test mode: one tap activates the subscription without a receipt. */
    subscriptionPay: () => request<DriverDto>("/api/driver/subscription/pay", { method: "POST" }),
    submit: () => request<DriverDto>("/api/driver/submit", { method: "POST" }),
    presence: (online: boolean) => request<{ online: boolean }>("/api/driver/presence", { body: { online } }),
    location: (body: { lat: number; lng: number; heading?: number | null; speedKmh?: number | null; accuracyM?: number | null }) => request<{ activeRideId: string | null }>("/api/driver/location", { body }),
    feed: (signal?: AbortSignal) => request<{ items: DriverRequestFeedItem[]; online: boolean; serverTime: string }>("/api/driver/feed", { signal }),
    bids: () => request<{ items: BidDto[] }>("/api/driver/bids"),
    placeBid: (requestId: string, body: PlaceBidInput) => request<BidDto>(`/api/driver/requests/${requestId}/bids`, { body }),
    withdrawBid: (bidId: string) => request<{ ok: boolean }>(`/api/driver/bids/${bidId}`, { method: "DELETE" }),
    earnings: () => request<DriverEarningsDto>("/api/driver/earnings"),
  },

  support: {
    tickets: () => request<{ items: SupportTicketDto[] }>("/api/support/tickets"),
    escalate: (ticketId: string) => request<SupportTicketDto>("/api/support/escalate", { body: { ticketId } }),
    /** Streams assistant text; resolves with ticketId when done. */
    send: async (body: { body: string; ticketId?: string }, onDelta: (text: string) => void, signal?: AbortSignal) => {
      const res = await request<Response>("/api/support/messages", { body, raw: true, signal });
      if (!res.ok) {
        let msg = "Support is unavailable right now";
        try {
          const j = (await res.json()) as { error?: { message?: string } };
          msg = j.error?.message ?? msg;
        } catch {
          /* ignore */
        }
        throw new ApiRequestError(res.status, "support_error", msg);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new ApiRequestError(0, "stream", "Streaming not supported");
      const dec = new TextDecoder();
      let buf = "";
      let ticketId: string | null = body.ticketId ?? null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5)) as { delta?: string; done?: boolean; ticketId?: string; error?: string };
            if (j.delta) onDelta(j.delta);
            if (j.ticketId) ticketId = j.ticketId;
            if (j.error) throw new ApiRequestError(500, "support_error", j.error);
          } catch (e) {
            if (e instanceof ApiRequestError) throw e;
          }
        }
      }
      return { ticketId };
    },
  },

  admin: {
    stats: () => request<AdminStatsDto>("/api/admin/stats"),
  },
};

export type Api = typeof api;

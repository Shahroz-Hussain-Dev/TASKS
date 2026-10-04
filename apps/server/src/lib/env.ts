/**
 * Centralised, validated environment access. Import `env` everywhere instead of
 * touching process.env so a misconfigured deployment fails loudly at the first
 * request with a readable message rather than deep inside a query.
 */
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  /** Optional comma-separated fallbacks (e.g. aws-1 pooler) tried when the primary refuses. */
  DATABASE_URL_FALLBACKS: z.string().optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_VISION_MODEL: z.string().default("gemini-2.5-flash"),
  ADMIN_EMAIL: z.string().email().default("admin@raahi.pk"),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().default("Raahi Admin"),
  /** Optional Supabase Storage for files; falls back to Postgres bytea when absent. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("raahi-files"),
  OSRM_URL: z.string().url().default("https://router.project-osrm.org"),
  PHOTON_URL: z.string().url().default("https://photon.komoot.io"),
  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  APP_PUBLIC_URL: z.string().url().optional(),
  /** Comma separated extra CORS origins (mobile uses capacitor://localhost & http://localhost). */
  CORS_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTO_MIGRATE: z
    .string()
    .optional()
    .transform((v) => v === undefined || v === "true" || v === "1"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";

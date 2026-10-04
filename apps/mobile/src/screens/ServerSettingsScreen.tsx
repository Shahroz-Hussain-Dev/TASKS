import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, CheckCircle2, Database, Globe, Info, RefreshCw, Save, Server, Smartphone, XCircle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Input, Screen, TopBar, useToast } from "@/components/ui";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { APP_VERSION, DEFAULT_API_URL, MAP_STYLE_URL, getApiBaseUrl, setApiBaseUrl } from "@/lib/config";
import { item, spring, stagger } from "@/lib/motion";
import { haptic, isNative } from "@/lib/native";
import { cn } from "@/lib/utils";

interface HealthResult {
  ok: boolean;
  db: boolean;
  time: string;
  latencyMs: number;
  url: string;
}

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function validateUrl(raw: string): { url: string | null; error: string | null; warning: string | null } {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return { url: "", error: null, warning: isNative ? "Without a server address the app can't sign in." : "Empty means same origin as the web app." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: null, error: "Enter a full address, e.g. https://raahi.vercel.app", warning: null };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { url: null, error: "Address must start with https://", warning: null };
  if (parsed.pathname !== "/" && parsed.pathname !== "") return { url: null, error: "Use the server root only, without a path", warning: null };
  if (parsed.search || parsed.hash) return { url: null, error: "Remove anything after the host name", warning: null };
  const url = `${parsed.protocol}//${parsed.host}`;
  if (parsed.protocol === "http:") {
    if (!PRIVATE_HOST.test(parsed.hostname)) return { url: null, error: "Plain http is only allowed for local network addresses", warning: null };
    return { url, error: null, warning: isNative ? "Plain http is blocked in release builds. Use it for local testing only." : null };
  }
  return { url, error: null, warning: null };
}

async function probe(url: string): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  const started = performance.now();
  try {
    const res = await fetch(`${url || window.location.origin}/api/health`, { headers: { Accept: "application/json" }, signal: controller.signal });
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) throw new Error(`Server answered ${res.status}. Is this the Raahi API?`);
    const json = (await res.json()) as Partial<{ ok: boolean; db: boolean; time: string }>;
    if (typeof json.ok !== "boolean") throw new Error("That address isn't a Raahi server.");
    return { ok: json.ok, db: Boolean(json.db), time: json.time ?? new Date().toISOString(), latencyMs, url };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("Timed out after 8 seconds. Check the address and your connection.");
    if (err instanceof TypeError) throw new Error("Couldn't reach that address. Check the spelling and that the server is online.");
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Lets a built APK be pointed at a different deployment. Reached by
 * long-pressing the logo on Welcome or the version label on Profile.
 */
export default function ServerSettingsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const current = getApiBaseUrl();
  const [value, setValue] = useState(current);
  const [touched, setTouched] = useState(false);
  const check = useMemo(() => validateUrl(value), [value]);
  const dirty = (check.url ?? "") !== current;

  const test = useMutation({
    mutationFn: () => {
      if (check.url === null) throw new Error(check.error ?? "Invalid address");
      return probe(check.url);
    },
    onSuccess: (r) => haptic[r.ok && r.db ? "success" : "warning"](),
    onError: () => haptic.error(),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (check.url === null) throw new Error(check.error ?? "Invalid address");
      await setApiBaseUrl(check.url);
      return check.url;
    },
    onSuccess: (url) => {
      haptic.success();
      toast({ title: "Server saved", body: url ? `The app now talks to ${new URL(url).host}.` : "Using the default server.", tone: "success" });
      navigate(-1);
    },
    onError: (err) => toast({ title: "Couldn't save", body: err instanceof Error ? err.message : "Try again", tone: "error" }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (check.url === null) return;
    save.mutate();
  };

  const result = test.data;
  const testError = test.error instanceof Error ? test.error.message : null;
  const hostLabel = current ? safeHost(current) : isNative ? "Not configured" : "Same origin";

  return (
    <Screen>
      <OfflineBanner />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col gap-4">
        <motion.div variants={item.down}>
          <TopBar left={<BackButton fallback="/" />} title="Server" subtitle="Where this app sends its requests" />
        </motion.div>

        <motion.div variants={item.left}>
          <Card className="flex items-center gap-3">
            <span className="size-11 rounded-2xl bg-brand-500/12 text-brand-400 flex items-center justify-center shrink-0">
              <Server className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-ink-400">Currently connected to</p>
              <p className="font-display text-[16px] font-semibold text-ink-50 truncate">{hostLabel}</p>
            </div>
            {current && current === DEFAULT_API_URL && <Badge tone="brand">Default</Badge>}
          </Card>
        </motion.div>

        <motion.form variants={item.up} onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Input
            label="API address"
            icon={Globe}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://raahi.vercel.app"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              test.reset();
            }}
            onBlur={() => setTouched(true)}
            error={touched ? check.error : null}
            hint={check.warning ?? "Enter the root of your Raahi deployment, then test before saving."}
          />

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" icon={Activity} loading={test.isPending} disabled={check.url === null} onClick={() => test.mutate()}>
              Test connection
            </Button>
            <Button type="submit" icon={Save} loading={save.isPending} disabled={check.url === null || !dirty}>
              Save
            </Button>
          </div>

          <AnimatePresence initial={false} mode="wait">
            {result && (
              <motion.div key="ok" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
                <Card className={cn("border", result.ok && result.db ? "border-brand-500/30" : "border-amber-400/30")}>
                  <div className="flex items-center gap-2.5 mb-3">
                    {result.ok ? <CheckCircle2 className="size-5 text-brand-400" /> : <XCircle className="size-5 text-amber-300" />}
                    <p className="font-semibold text-ink-50">{result.ok ? "Raahi server reachable" : "Server responded with a problem"}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <Stat icon={Activity} label="Latency" value={`${result.latencyMs} ms`} />
                    <Stat icon={Database} label="Database" value={result.db ? "Connected" : "Down"} tone={result.db ? "brand" : "rose"} />
                    <Stat icon={RefreshCw} label="Server time" value={new Date(result.time).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })} />
                  </dl>
                </Card>
              </motion.div>
            )}
            {testError && (
              <motion.div key="err" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
                <Card className="border border-rose-500/30 flex items-start gap-2.5">
                  <XCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-ink-50">Connection failed</p>
                    <p className="text-[13.5px] text-ink-300 mt-0.5 leading-snug">{testError}</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {DEFAULT_API_URL && value !== DEFAULT_API_URL && (
            <Button type="button" variant="ghost" size="md" onClick={() => {
              setValue(DEFAULT_API_URL);
              test.reset();
            }}>
              Use default ({safeHost(DEFAULT_API_URL)})
            </Button>
          )}
        </motion.form>

        <motion.div variants={item.right} className="mt-2">
          <div className="rounded-3xl bg-ink-800 border border-white/6 shadow-card overflow-hidden">
            <InfoRow icon={Smartphone} label="App version" value={`${APP_VERSION} · ${isNative ? "Android" : "Web"}`} />
            <InfoRow icon={Globe} label="Map tiles" value={safeHost(MAP_STYLE_URL)} />
            <InfoRow icon={Info} label="Build default" value={DEFAULT_API_URL ? safeHost(DEFAULT_API_URL) : "None baked in"} last />
          </div>
        </motion.div>
      </motion.div>
    </Screen>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Stat({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Activity; label: string; value: string; tone?: "neutral" | "brand" | "rose" }) {
  return (
    <div className="rounded-2xl bg-white/4 px-2 py-2.5">
      <Icon className={cn("size-4 mx-auto mb-1", tone === "brand" ? "text-brand-400" : tone === "rose" ? "text-rose-400" : "text-ink-400")} />
      <dt className="text-[11px] text-ink-500">{label}</dt>
      <dd className={cn("text-[13px] font-semibold tabular-nums", tone === "rose" ? "text-rose-400" : "text-ink-100")}>{value}</dd>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, last }: { icon: typeof Activity; label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", !last && "border-b border-white/6")}>
      <Icon className="size-[18px] text-ink-400 shrink-0" />
      <span className="text-[14px] text-ink-200 flex-1">{label}</span>
      <span className="text-[13px] text-ink-400 truncate max-w-[55%]">{value}</span>
    </div>
  );
}

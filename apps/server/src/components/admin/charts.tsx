"use client";

import { useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { VEHICLE_CATEGORY_META, type AdminStatsDto, type VehicleCategory } from "@raahi/shared";
import { CATEGORY_COLORS, cn, fmtDayKey, pkr } from "./format";
import { Chips } from "./ui";

type Metric = "rides" | "gmvPkr";

const METRIC_LABEL: Record<Metric, string> = { rides: "Rides", gmvPkr: "GMV" };
const METRIC_COLOR: Record<Metric, string> = { rides: "#34d399", gmvPkr: "#fbbf24" };

type SeriesPoint = AdminStatsDto["series"][number];

interface SeriesTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  metric: Metric;
}

function isSeriesPoint(v: unknown): v is SeriesPoint {
  return typeof v === "object" && v !== null && "date" in v && "rides" in v && "gmvPkr" in v;
}

function SeriesTooltip({ active, payload, metric }: SeriesTooltipProps) {
  const raw = payload?.[0]?.payload;
  const point = isSeriesPoint(raw) ? raw : undefined;
  if (!active || !point) return null;
  return (
    <div className="glass rounded-2xl px-3.5 py-2.5 text-[13px] shadow-float">
      <p className="font-semibold text-ink-50">{fmtDayKey(point.date)}</p>
      <p className="mt-1 text-ink-300">
        {metric === "rides" ? `${point.rides.toLocaleString("en-PK")} rides` : pkr(point.gmvPkr)}
      </p>
      <p className="text-ink-500">{point.signups} sign-ups</p>
    </div>
  );
}

/** 14-day trend, one measure at a time (never two y-axes). */
export function RidesAreaChart({ series }: { series: AdminStatsDto["series"] }) {
  const [metric, setMetric] = useState<Metric>("rides");
  const color = METRIC_COLOR[metric];
  const total = series.reduce((s, p) => s + p[metric], 0);
  const empty = total === 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-400">
          Last 14 days ·{" "}
          <span className="font-semibold text-ink-100">{metric === "rides" ? `${total.toLocaleString("en-PK")} completed rides` : `${pkr(total)} paid to drivers`}</span>
        </p>
        <Chips<Metric> value={metric} onChange={setMetric} layoutId="dash-metric" options={[{ value: "rides", label: "Rides" }, { value: "gmvPkr", label: "GMV" }]} />
      </div>
      <div className="relative h-[260px] w-full">
        {empty ? <p className="absolute inset-0 z-10 grid place-items-center text-[13.5px] text-ink-500">No completed rides in this window yet.</p> : null}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tickFormatter={fmtDayKey} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={56}
              tickFormatter={(v: number) => (metric === "gmvPkr" ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : String(v))}
            />
            <Tooltip cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }} content={(props) => <SeriesTooltip active={props.active} payload={props.payload} metric={metric} />} />
            <Area type="monotone" dataKey={metric} name={METRIC_LABEL[metric]} stroke={color} strokeWidth={2} fill={`url(#fill-${metric})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#111827" }} isAnimationActive animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Category share donut with a legend and direct labels so colour is never the only cue. */
export function CategoryDonut({ mix }: { mix: AdminStatsDto["categoryMix"] }) {
  const total = mix.reduce((s, m) => s + m.rides, 0);
  const data = mix.map((m) => ({ ...m, label: VEHICLE_CATEGORY_META[m.category].label }));
  const [activeCategory, setActiveCategory] = useState<VehicleCategory | null>(null);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        {total === 0 ? (
          <div className="absolute inset-0 grid place-items-center rounded-full border-[14px] border-ink-700 text-center text-[12.5px] text-ink-500">
            No rides
            <br />
            in 30 days
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter((d) => d.rides > 0)}
                  dataKey="rides"
                  nameKey="label"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={2}
                  cornerRadius={4}
                  stroke="#111827"
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={700}
                  onMouseEnter={(_, i) => {
                    const row = data.filter((d) => d.rides > 0)[i];
                    setActiveCategory(row?.category ?? null);
                  }}
                  onMouseLeave={() => setActiveCategory(null)}
                >
                  {data
                    .filter((d) => d.rides > 0)
                    .map((d) => (
                      <Cell key={d.category} fill={CATEGORY_COLORS[d.category]} opacity={activeCategory && activeCategory !== d.category ? 0.35 : 1} />
                    ))}
                </Pie>
                <Tooltip content={() => null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-display text-[26px] font-semibold leading-none text-ink-50">
                  {activeCategory ? `${Math.round(((data.find((d) => d.category === activeCategory)?.rides ?? 0) / total) * 100)}%` : total.toLocaleString("en-PK")}
                </p>
                <p className="mt-1 text-[11.5px] uppercase tracking-wide text-ink-500">{activeCategory ? VEHICLE_CATEGORY_META[activeCategory].label : "rides · 30d"}</p>
              </div>
            </div>
          </>
        )}
      </div>
      <ul className="w-full space-y-2">
        {data.map((d) => {
          const share = total > 0 ? Math.round((d.rides / total) * 100) : 0;
          return (
            <li
              key={d.category}
              onMouseEnter={() => setActiveCategory(d.category)}
              onMouseLeave={() => setActiveCategory(null)}
              className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13.5px] transition-colors", activeCategory === d.category && "bg-white/4")}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[d.category] }} />
              <span className="flex-1 text-ink-200">{d.label}</span>
              <span className="font-semibold text-ink-50">{d.rides.toLocaleString("en-PK")}</span>
              <span className="w-10 text-right text-ink-500">{share}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

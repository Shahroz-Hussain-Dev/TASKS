import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, GasPump, MagnifyingGlass, Palette, Sparkle } from "@phosphor-icons/react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { CUSTOM_VEHICLE_ID, VEHICLE_CATEGORY_META, vehicleUpsertSchema, vehiclesForCategory, type DriverDto, type VehicleCategory, type VehicleModel, type VehicleUpsertInput } from "@raahi/shared";
import { Breathe } from "@/components/driver/Breathe";
import { CategoryIcon } from "@/components/driver/CategoryIcon";
import { Button, Chip, Input, useToast } from "@/components/ui";
import { dk } from "@/hooks/driver/keys";
import { CATEGORY_ORDER, VEHICLE_COLORS } from "@/hooks/driver/onboarding";
import { useConfig } from "@/hooks/driver/useConfig";
import { useDriverMutation } from "@/hooks/driver/useDriver";
import { useStepForm, type ErrorMap } from "@/hooks/driver/useStepForm";
import { api, ApiRequestError } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

type Values = { make: string; model: string; year: string; color: string; plate: string; kmPerLitre: string };

const FUEL_LABEL: Record<VehicleModel["fuel"], string> = { petrol: "Petrol", hybrid: "Hybrid", cng: "CNG" };

/** Category colours: Moto = sky, Rickshaw = sun, Ride = coral, Ride AC = teal, Comfort = lavender. */
const CATEGORY_TINT: Record<VehicleCategory, { idle: string; icon: string; active: string }> = {
  bike: { idle: "bg-sky-100", icon: "text-sky-500", active: "bg-sky-500" },
  rickshaw: { idle: "bg-sun-100", icon: "text-sun-600", active: "bg-sun-500" },
  car: { idle: "bg-coral-100", icon: "text-coral-500", active: "bg-coral-500" },
  car_ac: { idle: "bg-teal-100", icon: "text-teal-500", active: "bg-teal-500" },
  car_premium: { idle: "bg-lavender-100", icon: "text-lavender-500", active: "bg-lavender-500" },
};

/** Step 2 — vehicle category, catalogue model (or custom), year, colour, plate. */
export function VehicleStep({ driver, onNext }: { driver: DriverDto; onNext: () => void }) {
  const toast = useToast();
  const { settings } = useConfig();
  const v = driver.vehicle;
  const [category, setCategory] = useState<VehicleCategory>(v?.category ?? "car");
  const [custom, setCustom] = useState<boolean>(v?.isCustom ?? false);
  const [catalogId, setCatalogId] = useState<string | null>(v && !v.isCustom ? v.catalogId : null);
  const [search, setSearch] = useState("");

  const catalog = useQuery({
    queryKey: dk.catalog(category),
    queryFn: () => api.vehicleCatalog(category),
    staleTime: 60 * 60_000,
    placeholderData: { items: vehiclesForCategory(category) },
  });
  const models = useMemo(() => {
    const items = catalog.data?.items ?? vehiclesForCategory(category);
    const q = search.trim().toLowerCase();
    return q ? items.filter((m) => `${m.make} ${m.model}`.toLowerCase().includes(q)) : items;
  }, [catalog.data, category, search]);
  const selected = useMemo(() => (catalogId ? (catalog.data?.items ?? vehiclesForCategory(category)).find((m) => m.id === catalogId) ?? null : null), [catalogId, catalog.data, category]);

  const toPayload = useCallback(
    (f: Values) => ({
      category,
      catalogId: custom ? CUSTOM_VEHICLE_ID : (catalogId ?? ""),
      make: custom ? f.make : (selected?.make ?? ""),
      model: custom ? f.model : (selected?.model ?? ""),
      year: f.year ? Number(f.year) : Number.NaN,
      color: f.color,
      plate: f.plate,
      kmPerLitre: custom ? (f.kmPerLitre ? Number(f.kmPerLitre) : undefined) : undefined,
    }),
    [category, custom, catalogId, selected],
  );

  const rules = useCallback(
    (f: Values): ErrorMap<Values> => {
      const out: ErrorMap<Values> = {};
      if (custom && !f.kmPerLitre) out.kmPerLitre = "Enter your real-world fuel economy";
      if (!f.year) out.year = "Enter the model year";
      return out;
    },
    [custom],
  );

  const form = useStepForm({
    schema: vehicleUpsertSchema,
    initial: { make: v?.isCustom ? v.make : "", model: v?.isCustom ? v.model : "", year: v ? String(v.year) : "", color: v?.color ?? "", plate: v?.plate ?? "", kmPerLitre: v?.isCustom ? String(v.kmPerLitre) : "" } satisfies Values,
    toPayload,
    extra: rules,
  });

  const save = useDriverMutation((body: VehicleUpsertInput) => api.driver.vehicle(body), {
    onSuccess: () => {
      haptic.success();
      onNext();
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 409) form.setError("plate", "This number plate is already registered on Raahi");
      else toast({ title: "Couldn't save your vehicle", body: errorMessage(err), tone: "error" });
    },
  });

  const [modelError, setModelError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!custom && !catalogId) {
      setModelError("Pick your vehicle from the list, or add it manually");
      haptic.warning();
      return;
    }
    setModelError(null);
    const parsed = form.validate();
    if (!parsed) {
      haptic.warning();
      return;
    }
    save.mutate(parsed);
  };

  const pickCategory = (c: VehicleCategory) => {
    if (c === category) return;
    setCategory(c);
    setCatalogId(null);
    setSearch("");
    setModelError(null);
  };

  const kmPerLitre = custom ? Number(form.values.kmPerLitre) || null : (selected?.kmPerLitre ?? null);
  const fuelPer10Km = kmPerLitre ? Math.round((10 / kmPerLitre) * settings.petrolPricePkr) : null;

  return (
    <motion.form variants={stagger(0.06)} initial="hidden" animate="show" onSubmit={submit} noValidate className="flex flex-col gap-5 pb-4">
      {/* Category */}
      <motion.div variants={item.left} className="flex flex-col gap-2">
        <p className="text-[13.5px] font-extrabold text-ink-600 tracking-wide pl-1">Service type</p>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 pt-1">
          {CATEGORY_ORDER.map((c) => {
            const meta = VEHICLE_CATEGORY_META[c];
            const active = c === category;
            const tint = CATEGORY_TINT[c];
            return (
              <motion.button key={c} type="button" whileTap={{ scale: 0.95 }} transition={spring} onClick={() => pickCategory(c)} className={cn("relative shrink-0 w-[108px] rounded-[24px] p-3 text-left transition-colors", tint.idle, active && "sticker sticker-tilt-r")}>
                {active && <motion.span layoutId="veh-cat" className="absolute inset-0 rounded-[24px] ring-[3px] ring-white" transition={spring} />}
                <span className={cn("relative size-10 rounded-[14px] flex items-center justify-center bg-white", active ? cn(tint.active, "text-white") : tint.icon)}>
                  <CategoryIcon category={c} className="size-6" weight={active ? "fill" : "duotone"} />
                </span>
                <p className="relative mt-2 text-[14px] font-extrabold text-ink-900">{meta.label}</p>
                <p className="relative text-[11px] font-bold text-ink-500 leading-tight mt-0.5">{meta.seats} seat{meta.seats === 1 ? "" : "s"}</p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Model */}
      <motion.div variants={item.right} className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[13.5px] font-extrabold text-ink-600 tracking-wide">Make & model</p>
          <button type="button" onClick={() => { haptic.tick(); setCustom((c) => !c); setModelError(null); }} className="text-[13px] font-extrabold text-teal-600">
            {custom ? "Choose from list" : "Not listed? Add manually"}
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {custom ? (
            <motion.div key="custom" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Make" placeholder="Suzuki" autoCapitalize="words" {...form.bind("make")} />
                <Input label="Model" placeholder="Alto" autoCapitalize="words" {...form.bind("model")} />
              </div>
              <Input label="Fuel economy (km per litre)" icon={GasPump} inputMode="decimal" placeholder="e.g. 14" {...form.bind("kmPerLitre")} hint="Your real mixed-city average. Admins may double-check custom vehicles." />
            </motion.div>
          ) : (
            <motion.div key="catalog" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={spring} className="flex flex-col gap-2">
              <Input icon={MagnifyingGlass} placeholder={`Search ${VEHICLE_CATEGORY_META[category].label.toLowerCase()} models`} value={search} onChange={(e) => setSearch(e.target.value)} error={modelError} autoCapitalize="none" />
              <div className="pillow overflow-hidden max-h-64 overflow-y-auto no-scrollbar">
                {models.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13.5px] font-semibold text-ink-500">No match. Try another spelling or add it manually.</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {models.map((m) => {
                      const active = m.id === catalogId;
                      return (
                        <motion.button
                          key={m.id}
                          type="button"
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          whileTap={{ scale: 0.985 }}
                          transition={spring}
                          onClick={() => {
                            haptic.tick();
                            setCatalogId(m.id);
                            setModelError(null);
                          }}
                          className={cn("w-full flex items-center gap-3 px-4 py-3 text-left border-b border-paper-200 last:border-b-0 transition-colors", active ? "bg-teal-100/70" : "hover:bg-paper-100")}
                        >
                          <span className={cn("size-6 rounded-full border-[2.5px] flex items-center justify-center shrink-0 transition-colors", active ? "border-teal-500 bg-teal-500 text-white" : "border-paper-300 bg-white")}>{active && <Check className="size-3.5" weight="bold" />}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[15px] font-bold text-ink-900 truncate">
                              {m.make} {m.model}
                            </span>
                            <span className="block text-[12px] font-semibold text-ink-500">
                              {m.kmPerLitre} km/L · {FUEL_LABEL[m.fuel]}
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {fuelPer10Km !== null && (
            <motion.p key="fuel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-600 px-1">
              <Sparkle className="size-4 text-lavender-500" weight="duotone" />
              At {kmPerLitre} km/L, 10 km costs you about <span className="font-extrabold text-ink-900 tabular-nums">PKR {fuelPer10Km.toLocaleString("en-PK")}</span> in petrol.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Year / colour / plate */}
      <motion.div variants={item.up} className="grid grid-cols-2 gap-3">
        <Input label="Model year" inputMode="numeric" placeholder={String(new Date().getFullYear() - 5)} maxLength={4} {...form.bind("year")} />
        <Input label="Number plate" autoCapitalize="characters" placeholder="LEA 1234" {...form.bind("plate")} onChange={(e) => form.set("plate", e.target.value.toUpperCase())} />
      </motion.div>
      <motion.div variants={item.up} className="flex flex-col gap-2">
        <Input label="Colour" icon={Palette} autoCapitalize="words" placeholder="White" {...form.bind("color")} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          {VEHICLE_COLORS.map((c) => (
            <Chip key={c} tone="teal" active={form.values.color.trim().toLowerCase() === c.toLowerCase()} onClick={() => form.set("color", c)} className="shrink-0">
              {c}
            </Chip>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item.up} className="pt-1">
        <Breathe>
          <Button type="submit" full size="xl" variant="teal" loading={save.isPending}>
            Save & continue
          </Button>
        </Breathe>
      </motion.div>
    </motion.form>
  );
}

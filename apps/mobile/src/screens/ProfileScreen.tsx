import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Camera, Car, CaretRight, EnvelopeSimple, GearSix, HardDrives, Image as ImageIcon, Key, Lifebuoy, PencilSimple, Receipt, ShieldCheck, SignOut, Trash, User } from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { changePasswordSchema, formatPkPhone, fullNameSchema, optionalEmailSchema, type DriverDto, type UserDto } from "@raahi/shared";
import { Avatar, Badge, Button, Divider, Input, Row, Screen, Sheet, Spinner, Stars, TopBar, useToast } from "@/components/ui";
import { BackButton } from "@/components/shared/BackButton";
import { ConfirmSheet } from "@/components/shared/ConfirmSheet";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { vehicleLine } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { useLongPress } from "@/hooks/useLongPress";
import { useZodForm } from "@/hooks/useZodForm";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { APP_VERSION, getApiBaseUrl } from "@/lib/config";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic, pickImage } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

const profileSchema = z.object({ fullName: fullNameSchema, email: optionalEmailSchema });
type ProfileValues = { fullName: string; email: string };

type PasswordValues = { currentPassword: string; newPassword: string; confirm: string };
const passwordRule = (v: PasswordValues) => {
  if (!v.confirm) return v.newPassword ? { confirm: "Re-enter your new password" } : {};
  if (v.confirm !== v.newPassword) return { confirm: "Passwords don't match" };
  if (v.currentPassword && v.currentPassword === v.newPassword) return { newPassword: "Choose a different password" };
  return {};
};

const DRIVER_STATUS_TONE: Record<DriverDto["status"], "teal" | "sun" | "rose" | "neutral"> = {
  approved: "teal",
  under_review: "sun",
  onboarding: "neutral",
  rejected: "rose",
  suspended: "rose",
};
const DRIVER_STATUS_LABEL: Record<DriverDto["status"], string> = {
  approved: "Approved",
  under_review: "Under review",
  onboarding: "Onboarding",
  rejected: "Rejected",
  suspended: "Suspended",
};

type SheetKind = "avatar" | "edit" | "password" | "logout" | "delete" | null;

export default function ProfileScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, driver, setUser, logout } = useAuth();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [serverRevealed, setServerRevealed] = useState(false);
  const versionPress = useLongPress(() => {
    setServerRevealed(true);
    toast({ title: "Developer options unlocked", body: "Server settings are now visible below.", tone: "brand" });
  }, 3000);

  const badge = useQuery({
    queryKey: qk.notificationsBadge,
    queryFn: () => api.me.notifications(1),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    enabled: Boolean(user),
  });
  const unread = badge.data?.unread ?? 0;

  const avatar = useMutation({
    mutationFn: async (source: "camera" | "gallery" | "remove") => {
      if (source === "remove") return api.me.update({ avatarFileId: null });
      const blob = await pickImage(source);
      if (!blob) return null;
      const up = await api.files.upload(blob, "avatar", "avatar.jpg");
      return api.me.update({ avatarFileId: up.file.id });
    },
    onSuccess: (res, source) => {
      if (!res) return;
      setUser(res.user);
      haptic.success();
      toast({ title: source === "remove" ? "Photo removed" : "Photo updated", tone: "success" });
    },
    onError: (err) => toast({ title: "Couldn't update photo", body: errorMessage(err), tone: "error" }),
    onSettled: () => setSheet(null),
  });

  const home = user?.role === "driver" ? "/d" : "/c";
  const isDriver = user?.role === "driver";

  if (!user) return null;

  return (
    <Screen padded={false}>
      <OfflineBanner />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col flex-1 pb-6" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="px-5">
          <TopBar left={<BackButton fallback={home} />} title="Profile" />
        </motion.div>

        {/* Identity: avatar in a sticker frame over a tinted blob */}
        <motion.section variants={item.left} className="relative mx-5 mt-1 overflow-hidden pillow">
          <span aria-hidden className={cn("blob absolute -left-10 -top-14 size-44", isDriver ? "bg-teal-100" : "bg-coral-100")} />
          <span aria-hidden className="blob absolute -right-12 -bottom-16 size-40 bg-sun-100" style={{ animationDelay: "-7s" }} />
          <div className="relative p-5 flex items-center gap-4">
            <motion.button type="button" whileTap={{ scale: 0.95, rotate: 0 }} initial={{ rotate: -4 }} animate={{ rotate: -4 }} transition={spring} onClick={() => setSheet("avatar")} className="relative shrink-0" aria-label="Change photo">
              <span className="block rounded-[26px] bg-white p-1.5 shadow-[0_14px_30px_-16px_rgb(63_42_20/0.35)]">
                <span className={cn("block rounded-[20px] p-1.5", isDriver ? "bg-teal-100" : "bg-coral-100")}>
                  <Avatar name={user.fullName} src={user.avatarUrl} size={80} />
                </span>
              </span>
              <AnimatePresence>
                {avatar.isPending && (
                  <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-3 rounded-full bg-white/70 flex items-center justify-center">
                    <Spinner />
                  </motion.span>
                )}
              </AnimatePresence>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.5 }} className={cn("absolute -right-2 -bottom-2 size-9 rounded-full text-white flex items-center justify-center border-[3px] border-white shadow-pillow", isDriver ? "bg-teal-500" : "bg-coral-500")}>
                <Camera className="size-4" weight="fill" />
              </motion.span>
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-[22px] font-semibold text-ink-900 truncate">{user.fullName}</h2>
                <Badge tone={isDriver ? "teal" : "coral"}>{isDriver ? "Driver" : "Rider"}</Badge>
              </div>
              {user.phone && <p className="text-[14.5px] text-ink-700 mt-0.5 font-bold">{formatPkPhone(user.phone)}</p>}
              {user.email && <p className="text-[13px] text-ink-500 truncate font-semibold">{user.email}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Stars value={Math.round(user.ratingAvg)} size={15} />
                <span className="text-[12.5px] text-ink-500 tabular-nums font-bold">
                  {user.ratingCount > 0 ? `${user.ratingAvg.toFixed(1)} · ${user.ratingCount} rating${user.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Driver summary */}
        {driver && (
          <motion.section variants={item.right} className="mx-5 mt-4">
            <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={() => navigate(driver.status === "approved" ? "/d/subscription" : "/d")} className="w-full text-left rounded-[26px] bg-teal-100 p-4 flex items-center gap-3 shadow-[0_4px_0_0_#b7e8df]">
              <span className="size-12 rounded-2xl bg-white text-teal-600 flex items-center justify-center shrink-0 shadow-pillow">
                <Car className="size-6" weight="duotone" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-[16px] font-semibold text-ink-900 truncate">{vehicleLine(driver.vehicle) ?? "Vehicle not added yet"}</p>
                  <Badge tone={DRIVER_STATUS_TONE[driver.status]}>{DRIVER_STATUS_LABEL[driver.status]}</Badge>
                </div>
                <p className="text-[13px] text-teal-700 mt-0.5 truncate font-bold">
                  {driver.subscriptionActive && driver.subscription?.endsAt ? `Subscription active until ${new Date(driver.subscription.endsAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}` : "Subscription inactive"}
                  {" · "}
                  {driver.totalRides} ride{driver.totalRides === 1 ? "" : "s"}
                </p>
              </div>
              <CaretRight className="size-5 text-teal-600" weight="bold" />
            </motion.button>
          </motion.section>
        )}

        {/* Groups */}
        <motion.div variants={item.up} className="mx-5 mt-5 flex flex-col gap-4">
          <Group title="Account">
            <Row icon={PencilSimple} tone="coral" label="Edit name & email" onClick={() => setSheet("edit")} right={<Chevron />} />
            <Divider />
            <Row icon={Key} tone="lavender" label="Change password" onClick={() => setSheet("password")} right={<Chevron />} />
          </Group>

          <Group title="App">
            <Row
              icon={Bell}
              tone="sun"
              label="Notifications"
              onClick={() => navigate("/notifications")}
              right={
                <span className="flex items-center gap-2">
                  {unread > 0 && <span className="min-w-6 h-6 px-1.5 rounded-full bg-coral-500 text-white text-[12px] font-extrabold flex items-center justify-center tabular-nums">{unread > 99 ? "99+" : unread}</span>}
                  <Chevron />
                </span>
              }
            />
            <Divider />
            <Row icon={GearSix} tone="sky" label="Settings" onClick={() => navigate("/settings")} right={<Chevron />} />
            <Divider />
            <Row icon={Lifebuoy} tone="teal" label="Help & support" onClick={() => navigate("/support")} right={<Chevron />} />
            {driver && (
              <>
                <Divider />
                <Row icon={Receipt} tone="lavender" label="Driver subscription" onClick={() => navigate("/d/subscription")} right={<Chevron />} />
              </>
            )}
            <AnimatePresence initial={false}>
              {serverRevealed && (
                <motion.div key="server" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                  <Divider />
                  <Row icon={HardDrives} tone="sky" label="Server" value={hostOf(getApiBaseUrl())} onClick={() => navigate("/settings/server")} right={<Chevron />} />
                </motion.div>
              )}
            </AnimatePresence>
          </Group>

          <Group title="Session">
            <Row icon={SignOut} tone="coral" label="Log out" onClick={() => setSheet("logout")} />
            <Divider />
            <Row icon={Trash} label="Delete account" danger onClick={() => setSheet("delete")} />
          </Group>
        </motion.div>

        <motion.div variants={item.fade} className="mt-8 flex flex-col items-center gap-1.5 select-none touch-none" {...versionPress.handlers}>
          <ShieldCheck className="size-5 text-ink-300" weight="duotone" />
          <p className={cn("text-[12px] tabular-nums transition-colors font-bold", versionPress.pressing ? "text-coral-500" : "text-ink-400")}>Raahi v{APP_VERSION}</p>
          <div className="h-1 w-24 rounded-full bg-paper-200 overflow-hidden">
            <motion.div className="h-full bg-coral-500" initial={{ width: 0 }} animate={{ width: versionPress.pressing ? "100%" : 0 }} transition={{ duration: versionPress.pressing ? versionPress.durationMs / 1000 : 0.2, ease: "linear" }} />
          </div>
        </motion.div>
      </motion.div>

      {/* Sheets */}
      <Sheet open={sheet === "avatar"} onClose={() => setSheet(null)} title="Profile photo">
        <div className="flex flex-col gap-2.5 pb-2">
          <Button variant="secondary" icon={Camera} full loading={avatar.isPending && avatar.variables === "camera"} disabled={avatar.isPending} onClick={() => avatar.mutate("camera")}>
            Take a photo
          </Button>
          <Button variant="secondary" icon={ImageIcon} full loading={avatar.isPending && avatar.variables === "gallery"} disabled={avatar.isPending} onClick={() => avatar.mutate("gallery")}>
            Choose from gallery
          </Button>
          {user.avatarUrl && (
            <Button variant="danger" icon={Trash} full loading={avatar.isPending && avatar.variables === "remove"} disabled={avatar.isPending} onClick={() => avatar.mutate("remove")}>
              Remove photo
            </Button>
          )}
        </div>
      </Sheet>

      <EditProfileSheet open={sheet === "edit"} user={user} onClose={() => setSheet(null)} onSaved={setUser} />
      <ChangePasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />

      <ConfirmSheet
        open={sheet === "logout"}
        onClose={() => setSheet(null)}
        title="Log out?"
        icon={SignOut}
        tone="primary"
        body="You'll need your phone number and password to sign back in."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        onConfirm={async () => {
          await logout();
          navigate("/welcome", { replace: true });
        }}
      />

      <ConfirmSheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title="Delete your account?"
        icon={Trash}
        tone="danger"
        confirmLabel="Delete my account"
        cancelLabel="Keep my account"
        body={
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Your profile, saved details and ratings are removed.</li>
            <li>Ride history is anonymised and kept for legal and safety records.</li>
            {driver && <li>Your driver documents and subscription are closed. Subscription payments are not refunded.</li>}
            <li>This cannot be undone.</li>
          </ul>
        }
        onConfirm={async () => {
          await api.me.deleteAccount();
          await logout();
          toast({ title: "Account deleted", body: "We're sorry to see you go. Safe travels.", tone: "neutral" });
          navigate("/welcome", { replace: true });
        }}
      />
    </Screen>
  );
}

function hostOf(url: string): string {
  if (!url) return "Default";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Chevron() {
  return <CaretRight className="size-[18px] text-ink-300" weight="bold" />;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="px-3 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-ink-400">{title}</p>
      <div className="pillow py-1.5 px-3">{children}</div>
    </section>
  );
}

function EditProfileSheet({ open, user, onClose, onSaved }: { open: boolean; user: UserDto; onClose: () => void; onSaved: (u: UserDto) => void }) {
  const toast = useToast();
  const form = useZodForm(profileSchema, { fullName: user.fullName, email: user.email ?? "" } satisfies ProfileValues);
  const save = useMutation({
    mutationFn: (input: { fullName: string; email?: string }) => api.me.update({ fullName: input.fullName, email: input.email ?? "" }),
    onSuccess: (res) => {
      haptic.success();
      onSaved(res.user);
      toast({ title: "Profile updated", tone: "success" });
      onClose();
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 409) form.setError("email", "This email is used by another account");
      else toast({ title: "Couldn't save", body: errorMessage(err), tone: "error" });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) return haptic.warning();
    save.mutate(parsed);
  };
  const dirty = form.values.fullName.trim() !== user.fullName || form.values.email.trim() !== (user.email ?? "");
  return (
    <Sheet
      open={open}
      onClose={() => {
        form.reset({ fullName: user.fullName, email: user.email ?? "" });
        onClose();
      }}
      title="Edit profile"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <Input label="Full name" icon={User} autoComplete="name" autoCapitalize="words" {...form.bind("fullName")} />
        <Input label="Email (optional)" icon={EnvelopeSimple} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" {...form.bind("email")} />
        {user.phone && <p className="text-[12.5px] text-ink-500 px-1 font-medium">Your mobile number ({formatPkPhone(user.phone)}) is your sign-in and can't be changed here. Contact support if it has changed.</p>}
        <Button type="submit" full size="xl" loading={save.isPending} disabled={!dirty}>
          Save changes
        </Button>
      </form>
    </Sheet>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useZodForm(changePasswordSchema, { currentPassword: "", newPassword: "", confirm: "" } satisfies PasswordValues, passwordRule);
  const change = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.me.changePassword(input),
    onSuccess: () => {
      haptic.success();
      toast({ title: "Password updated", body: "Other devices have been signed out.", tone: "success" });
      form.reset();
      onClose();
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 400)) form.setError("currentPassword", "That isn't your current password");
      else toast({ title: "Couldn't change password", body: errorMessage(err), tone: "error" });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) return haptic.warning();
    change.mutate(parsed);
  };
  return (
    <Sheet
      open={open}
      onClose={() => {
        form.reset();
        onClose();
      }}
      title="Change password"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <PasswordInput label="Current password" autoComplete="current-password" placeholder="Your current password" {...form.bind("currentPassword")} />
        <PasswordInput label="New password" autoComplete="new-password" placeholder="At least 8 characters" {...form.bind("newPassword")} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" placeholder="Type it again" {...form.bind("confirm")} />
        <Button type="submit" full size="xl" loading={change.isPending}>
          Update password
        </Button>
      </form>
    </Sheet>
  );
}

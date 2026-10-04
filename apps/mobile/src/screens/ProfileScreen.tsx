import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Camera, Car, ChevronRight, Image as ImageIcon, KeyRound, LifeBuoy, LogOut, Pencil, Receipt, Server, ShieldCheck, Trash2, UserRound, Mail } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { changePasswordSchema, formatPkPhone, fullNameSchema, optionalEmailSchema, type DriverDto, type UserDto } from "@raahi/shared";
import { Avatar, Badge, Button, Card, Divider, Input, Row, Screen, Sheet, Spinner, Stars, TopBar, useToast } from "@/components/ui";
import { Aurora } from "@/components/shared/Aurora";
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

const DRIVER_STATUS_TONE: Record<DriverDto["status"], "brand" | "amber" | "rose" | "neutral"> = {
  approved: "brand",
  under_review: "amber",
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

  if (!user) return null;

  return (
    <Screen padded={false}>
      <OfflineBanner />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col flex-1 pb-6" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="px-5">
          <TopBar left={<BackButton fallback={home} />} title="Profile" />
        </motion.div>

        {/* Identity */}
        <motion.section variants={item.left} className="relative mx-5 mt-1 overflow-hidden rounded-[32px] bg-ink-800 border border-white/8 shadow-card">
          <Aurora variant="soft" intensity={0.9} />
          <div className="relative p-5 flex items-center gap-4">
            <motion.button type="button" whileTap={{ scale: 0.95 }} transition={spring} onClick={() => setSheet("avatar")} className="relative shrink-0" aria-label="Change photo">
              <Avatar name={user.fullName} src={user.avatarUrl} size={84} ring />
              <AnimatePresence>
                {avatar.isPending && (
                  <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 rounded-full bg-ink-950/60 flex items-center justify-center">
                    <Spinner />
                  </motion.span>
                )}
              </AnimatePresence>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.5 }} className="absolute -right-0.5 -bottom-0.5 size-8 rounded-full bg-brand-500 text-ink-950 flex items-center justify-center border-[3px] border-ink-800">
                <Camera className="size-3.5" strokeWidth={2.4} />
              </motion.span>
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[21px] font-semibold text-ink-50 truncate">{user.fullName}</h2>
                <Badge tone={user.role === "driver" ? "amber" : "brand"}>{user.role === "driver" ? "Driver" : "Rider"}</Badge>
              </div>
              {user.phone && <p className="text-[14px] text-ink-300 mt-0.5">{formatPkPhone(user.phone)}</p>}
              {user.email && <p className="text-[13px] text-ink-400 truncate">{user.email}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Stars value={Math.round(user.ratingAvg)} size={14} />
                <span className="text-[12.5px] text-ink-400 tabular-nums">
                  {user.ratingCount > 0 ? `${user.ratingAvg.toFixed(1)} · ${user.ratingCount} rating${user.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Driver summary */}
        {driver && (
          <motion.section variants={item.right} className="mx-5 mt-4">
            <Card onClick={() => navigate(driver.status === "approved" ? "/d/subscription" : "/d")} className="flex items-center gap-3">
              <span className="size-11 rounded-2xl bg-amber-400/12 text-amber-300 flex items-center justify-center shrink-0">
                <Car className="size-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-50 truncate">{vehicleLine(driver.vehicle) ?? "Vehicle not added yet"}</p>
                  <Badge tone={DRIVER_STATUS_TONE[driver.status]}>{DRIVER_STATUS_LABEL[driver.status]}</Badge>
                </div>
                <p className="text-[13px] text-ink-400 mt-0.5 truncate">
                  {driver.subscriptionActive && driver.subscription?.endsAt ? `Subscription active until ${new Date(driver.subscription.endsAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}` : "Subscription inactive"}
                  {" · "}
                  {driver.totalRides} ride{driver.totalRides === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight className="size-5 text-ink-500" />
            </Card>
          </motion.section>
        )}

        {/* Groups */}
        <motion.div variants={item.up} className="mx-5 mt-5 flex flex-col gap-4">
          <Group title="Account">
            <Row icon={Pencil} label="Edit name & email" onClick={() => setSheet("edit")} right={<Chevron />} />
            <Divider />
            <Row icon={KeyRound} label="Change password" onClick={() => setSheet("password")} right={<Chevron />} />
          </Group>

          <Group title="App">
            <Row icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} right={<span className="flex items-center gap-2">{unread > 0 && <span className="min-w-6 h-6 px-1.5 rounded-full bg-brand-500 text-ink-950 text-[12px] font-bold flex items-center justify-center tabular-nums">{unread > 99 ? "99+" : unread}</span>}<Chevron /></span>} />
            <Divider />
            <Row icon={LifeBuoy} label="Help & support" onClick={() => navigate("/support")} right={<Chevron />} />
            {driver && (
              <>
                <Divider />
                <Row icon={Receipt} label="Driver subscription" onClick={() => navigate("/d/subscription")} right={<Chevron />} />
              </>
            )}
            <AnimatePresence initial={false}>
              {serverRevealed && (
                <motion.div key="server" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                  <Divider />
                  <Row icon={Server} label="Server" value={hostOf(getApiBaseUrl())} onClick={() => navigate("/settings/server")} right={<Chevron />} />
                </motion.div>
              )}
            </AnimatePresence>
          </Group>

          <Group title="Session">
            <Row icon={LogOut} label="Log out" onClick={() => setSheet("logout")} />
            <Divider />
            <Row icon={Trash2} label="Delete account" danger onClick={() => setSheet("delete")} />
          </Group>
        </motion.div>

        <motion.div variants={item.fade} className="mt-8 flex flex-col items-center gap-1 select-none touch-none" {...versionPress.handlers}>
          <ShieldCheck className="size-4 text-ink-600" />
          <p className={cn("text-[12px] tabular-nums transition-colors", versionPress.pressing ? "text-brand-400" : "text-ink-500")}>Raahi v{APP_VERSION}</p>
          <div className="h-0.5 w-24 rounded-full bg-white/6 overflow-hidden">
            <motion.div className="h-full bg-brand-400" initial={{ width: 0 }} animate={{ width: versionPress.pressing ? "100%" : 0 }} transition={{ duration: versionPress.pressing ? versionPress.durationMs / 1000 : 0.2, ease: "linear" }} />
          </div>
        </motion.div>
      </motion.div>

      {/* Sheets */}
      <Sheet open={sheet === "avatar"} onClose={() => setSheet(null)} title="Profile photo">
        <div className="flex flex-col gap-2 pb-2">
          <Button variant="secondary" icon={Camera} full loading={avatar.isPending && avatar.variables === "camera"} disabled={avatar.isPending} onClick={() => avatar.mutate("camera")}>
            Take a photo
          </Button>
          <Button variant="secondary" icon={ImageIcon} full loading={avatar.isPending && avatar.variables === "gallery"} disabled={avatar.isPending} onClick={() => avatar.mutate("gallery")}>
            Choose from gallery
          </Button>
          {user.avatarUrl && (
            <Button variant="danger" icon={Trash2} full loading={avatar.isPending && avatar.variables === "remove"} disabled={avatar.isPending} onClick={() => avatar.mutate("remove")}>
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
        icon={LogOut}
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
        icon={Trash2}
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
  return <ChevronRight className="size-5 text-ink-500" />;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="px-2 mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-500">{title}</p>
      <div className="rounded-3xl bg-ink-800 border border-white/6 shadow-card py-1 px-3">{children}</div>
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
        <Input label="Full name" icon={UserRound} autoComplete="name" autoCapitalize="words" {...form.bind("fullName")} />
        <Input label="Email (optional)" icon={Mail} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" {...form.bind("email")} />
        {user.phone && <p className="text-[12.5px] text-ink-500 px-1">Your mobile number ({formatPkPhone(user.phone)}) is your sign-in and can't be changed here. Contact support if it has changed.</p>}
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

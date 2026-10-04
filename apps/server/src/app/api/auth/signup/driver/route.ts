import { createAccount } from "@/lib/core/signup";
import { requestMeta } from "@/lib/core/request-meta";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { driverSignupSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const meta = requestMeta(req);
  memoryLimit(`signup:${meta.ip}`, 30, 10 * 60_000);
  const body = await parseBody(req, driverSignupSchema);
  // The driver profile row is created alongside the user with status "onboarding".
  const auth = await createAccount({
    role: "driver",
    fullName: body.fullName,
    phone: body.phone,
    password: body.password,
    meta,
  });
  return json(auth, { status: 201 });
});

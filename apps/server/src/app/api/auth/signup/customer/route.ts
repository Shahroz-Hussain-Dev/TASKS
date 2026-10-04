import { createAccount } from "@/lib/core/signup";
import { requestMeta } from "@/lib/core/request-meta";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { customerSignupSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const meta = requestMeta(req);
  // Generous: Pakistani mobile networks put thousands of subscribers behind one CGNAT address.
  memoryLimit(`signup:${meta.ip}`, 30, 10 * 60_000);
  const body = await parseBody(req, customerSignupSchema);
  const auth = await createAccount({
    role: "customer",
    fullName: body.fullName,
    phone: body.phone,
    email: body.email,
    password: body.password,
    meta,
  });
  return json(auth, { status: 201 });
});

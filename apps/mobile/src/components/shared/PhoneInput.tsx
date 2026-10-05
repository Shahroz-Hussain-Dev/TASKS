import { Phone } from "@phosphor-icons/react";
import { forwardRef, type ChangeEvent } from "react";
import { DEFAULT_DIAL_CODE } from "@raahi/shared";
import { Input, type InputProps } from "@/components/ui";

/**
 * Pakistani mobile number field. Shows the +92 prefix and accepts anything the
 * shared `phoneSchema` can normalise (03XX…, 3XX…, +92…).
 */
export const PhoneInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "inputMode" | "prefix" | "icon">>(function PhoneInput({ onChange, placeholder = "3XX XXXXXXX", ...props }, ref) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 18);
    if (cleaned !== e.target.value) e.target.value = cleaned;
    onChange?.(e);
  };
  return <Input ref={ref} type="tel" inputMode="tel" autoComplete="tel" icon={Phone} prefix={DEFAULT_DIAL_CODE} placeholder={placeholder} onChange={handle} {...props} />;
});

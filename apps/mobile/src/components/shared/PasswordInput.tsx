import { Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { forwardRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui";
import { haptic } from "@/lib/native";

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "icon" | "right">>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  const Toggle = show ? EyeSlash : Eye;
  return (
    <Input
      ref={ref}
      type={show ? "text" : "password"}
      icon={LockKey}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      right={
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => {
            haptic.tick();
            setShow((s) => !s);
          }}
          className="text-ink-400 hover:text-ink-700 p-1 -mr-1 rounded-lg transition-colors"
        >
          <Toggle className="size-[22px]" weight="duotone" />
        </button>
      }
      {...props}
    />
  );
});

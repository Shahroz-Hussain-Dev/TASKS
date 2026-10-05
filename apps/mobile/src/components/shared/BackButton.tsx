import { ArrowLeft } from "@phosphor-icons/react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconButton } from "@/components/ui";

/**
 * Goes back in history when there is somewhere to go, otherwise to `fallback`
 * (deep links and cold starts land without history).
 */
export function BackButton({ fallback = "/", label = "Back", variant = "solid", size, className, onClick }: { fallback?: string; label?: string; variant?: "glass" | "solid" | "ghost" | "brand" | "coral" | "teal"; size?: number; className?: string; onClick?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <IconButton
      icon={ArrowLeft}
      label={label}
      variant={variant}
      weight="bold"
      size={size}
      className={className}
      onClick={() => {
        if (onClick) return onClick();
        if (location.key !== "default") navigate(-1);
        else navigate(fallback, { replace: true });
      }}
    />
  );
}

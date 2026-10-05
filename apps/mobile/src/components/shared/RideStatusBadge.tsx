import type { RideStatus } from "@raahi/shared";
import { Badge } from "@/components/ui";
import { RIDE_STATUS_META } from "./meta";

export function RideStatusBadge({ status, className }: { status: RideStatus; className?: string }) {
  const meta = RIDE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

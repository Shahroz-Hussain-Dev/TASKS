/** Query keys for the shared screens. Prefix-invalidation friendly. */
export const qk = {
  config: ["config"] as const,
  me: ["me"] as const,
  ride: (id: string) => ["ride", id] as const,
  rideMessages: (id: string) => ["ride", id, "messages"] as const,
  rides: ["rides"] as const,
  notifications: ["notifications"] as const,
  notificationsList: ["notifications", "list"] as const,
  notificationsBadge: ["notifications", "badge"] as const,
  supportTickets: ["support", "tickets"] as const,
};

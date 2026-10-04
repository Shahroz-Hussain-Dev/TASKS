import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["customer", "driver", "admin"]);
export const driverStatusEnum = pgEnum("driver_status", ["onboarding", "under_review", "approved", "rejected", "suspended"]);
export const vehicleCategoryEnum = pgEnum("vehicle_category", ["bike", "rickshaw", "car", "car_ac", "car_premium"]);
export const documentTypeEnum = pgEnum("document_type", [
  "selfie",
  "cnic_front",
  "cnic_back",
  "driving_license",
  "route_permit",
  "vehicle_registration",
  "vehicle_photo",
]);
export const documentStatusEnum = pgEnum("document_status", ["pending", "verified", "flagged", "rejected"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["pending", "active", "expired", "rejected"]);
export const requestStatusEnum = pgEnum("request_status", ["open", "accepted", "cancelled", "expired"]);
export const bidStatusEnum = pgEnum("bid_status", ["pending", "accepted", "rejected", "withdrawn", "expired"]);
export const rideStatusEnum = pgEnum("ride_status", [
  "assigned",
  "arrived",
  "in_progress",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_driver",
]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "awaiting_user", "resolved"]);
export const supportSenderEnum = pgEnum("support_sender", ["user", "assistant", "admin"]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRoleEnum("role").notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    /** E.164, unique per role so the same person can be a customer and a driver. */
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 200 }),
    passwordHash: text("password_hash").notNull(),
    avatarFileId: uuid("avatar_file_id"),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    isBlocked: boolean("is_blocked").notNull().default(false),
    blockedReason: text("blocked_reason"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_phone_role_uq").on(t.phone, t.role).where(sql`${t.phone} is not null`),
    uniqueIndex("users_email_role_uq").on(t.email, t.role).where(sql`${t.email} is not null`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), uniqueIndex("sessions_token_uq").on(t.refreshTokenHash)],
);

/* ------------------------------------------------------------------ */
/* Files (binary storage lives in Postgres by default; see lib/storage) */
/* ------------------------------------------------------------------ */

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 40 }).notNull(), // avatar | document | receipt | other
    mime: varchar("mime", { length: 60 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    /** "db" = bytes column, "supabase" = object path in Supabase Storage. */
    storage: varchar("storage", { length: 20 }).notNull().default("db"),
    storagePath: text("storage_path"),
    bytes: bytea("bytes"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_owner_idx").on(t.ownerId)],
);

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    status: driverStatusEnum("status").notNull().default("onboarding"),
    statusReason: text("status_reason"),
    cnic: varchar("cnic", { length: 13 }),
    dateOfBirth: varchar("date_of_birth", { length: 10 }),
    city: varchar("city", { length: 60 }),
    licenseNumber: varchar("license_number", { length: 40 }),
    licenseExpiry: varchar("license_expiry", { length: 10 }),
    emergencyContact: varchar("emergency_contact", { length: 20 }),
    isOnline: boolean("is_online").notNull().default(false),
    lastLat: doublePrecision("last_lat"),
    lastLng: doublePrecision("last_lng"),
    lastHeading: doublePrecision("last_heading"),
    lastSpeedKmh: doublePrecision("last_speed_kmh"),
    lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    totalRides: integer("total_rides").notNull().default(0),
    totalEarningsPkr: integer("total_earnings_pkr").notNull().default(0),
    bidsPlaced: integer("bids_placed").notNull().default(0),
    bidsWon: integer("bids_won").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("drivers_status_idx").on(t.status),
    index("drivers_online_idx").on(t.isOnline, t.lastLat, t.lastLng),
    uniqueIndex("drivers_cnic_uq").on(t.cnic).where(sql`${t.cnic} is not null`),
  ],
);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id")
    .notNull()
    .unique()
    .references(() => drivers.id, { onDelete: "cascade" }),
  category: vehicleCategoryEnum("category").notNull(),
  catalogId: varchar("catalog_id", { length: 60 }).notNull(),
  make: varchar("make", { length: 40 }).notNull(),
  model: varchar("model", { length: 40 }).notNull(),
  year: integer("year").notNull(),
  color: varchar("color", { length: 30 }).notNull(),
  plate: varchar("plate", { length: 12 }).notNull(),
  kmPerLitre: doublePrecision("km_per_litre").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  ...timestamps,
});

export const driverDocuments = pgTable(
  "driver_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    status: documentStatusEnum("status").notNull().default("pending"),
    aiVerdict: jsonb("ai_verdict"),
    reviewerNote: text("reviewer_note"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("driver_documents_type_uq").on(t.driverId, t.type)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    amountPkr: integer("amount_pkr").notNull(),
    method: varchar("method", { length: 20 }).notNull(),
    transactionRef: varchar("transaction_ref", { length: 60 }),
    receiptFileId: uuid("receipt_file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    reviewerNote: text("reviewer_note"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("subscriptions_driver_idx").on(t.driverId, t.status), index("subscriptions_ends_idx").on(t.endsAt)],
);

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

export const rideRequests = pgTable(
  "ride_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull().default("open"),
    category: vehicleCategoryEnum("category").notNull(),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    pickupName: varchar("pickup_name", { length: 120 }),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffName: varchar("dropoff_name", { length: 120 }),
    distanceKm: doublePrecision("distance_km").notNull(),
    durationMin: doublePrecision("duration_min").notNull(),
    routePolyline: text("route_polyline"),
    offeredFarePkr: integer("offered_fare_pkr").notNull(),
    minFarePkr: integer("min_fare_pkr").notNull(),
    maxFarePkr: integer("max_fare_pkr").notNull(),
    recommendedFarePkr: integer("recommended_fare_pkr").notNull(),
    fareBreakdown: jsonb("fare_breakdown").notNull(),
    passengers: integer("passengers").notNull().default(1),
    note: varchar("note", { length: 200 }),
    rideId: uuid("ride_id"),
    cancelReason: text("cancel_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("ride_requests_status_idx").on(t.status, t.expiresAt),
    index("ride_requests_customer_idx").on(t.customerId, t.createdAt),
    index("ride_requests_geo_idx").on(t.status, t.pickupLat, t.pickupLng),
  ],
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    status: bidStatusEnum("status").notNull().default("pending"),
    amountPkr: integer("amount_pkr").notNull(),
    etaMin: integer("eta_min").notNull(),
    message: varchar("message", { length: 120 }),
    driverLat: doublePrecision("driver_lat"),
    driverLng: doublePrecision("driver_lng"),
    distanceToPickupKm: doublePrecision("distance_to_pickup_km"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("bids_request_idx").on(t.requestId, t.status),
    index("bids_driver_idx").on(t.driverId, t.status),
    uniqueIndex("bids_one_pending_per_driver_uq").on(t.requestId, t.driverId).where(sql`${t.status} = 'pending'`),
  ],
);

export const rides = pgTable(
  "rides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => rideRequests.id, { onDelete: "restrict" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "restrict" }),
    status: rideStatusEnum("status").notNull().default("assigned"),
    category: vehicleCategoryEnum("category").notNull(),
    farePkr: integer("fare_pkr").notNull(),
    commissionPkr: integer("commission_pkr").notNull().default(0),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("cash"),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    pickupName: varchar("pickup_name", { length: 120 }),
    dropoffLat: doublePrecision("dropoff_lat").notNull(),
    dropoffLng: doublePrecision("dropoff_lng").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffName: varchar("dropoff_name", { length: 120 }),
    distanceKm: doublePrecision("distance_km").notNull(),
    durationMin: doublePrecision("duration_min").notNull(),
    routePolyline: text("route_polyline"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: varchar("cancelled_by", { length: 10 }),
    cancelReason: text("cancel_reason"),
    cancelDetails: text("cancel_details"),
    customerLastReadAt: timestamp("customer_last_read_at", { withTimezone: true }),
    driverLastReadAt: timestamp("driver_last_read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("rides_customer_idx").on(t.customerId, t.createdAt),
    index("rides_driver_idx").on(t.driverId, t.createdAt),
    index("rides_status_idx").on(t.status),
  ],
);

export const rideLocations = pgTable(
  "ride_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    heading: doublePrecision("heading"),
    speedKmh: doublePrecision("speed_kmh"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ride_locations_ride_idx").on(t.rideId, t.recordedAt)],
);

export const rideMessages = pgTable(
  "ride_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderRole: varchar("sender_role", { length: 10 }).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ride_messages_ride_idx").on(t.rideId, t.createdAt)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rateeId: uuid("ratee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    comment: varchar("comment", { length: 300 }),
    tags: jsonb("tags"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ratings_once_uq").on(t.rideId, t.raterId), index("ratings_ratee_idx").on(t.rateeId)],
);

/* ------------------------------------------------------------------ */
/* Support, notifications, settings, audit                             */
/* ------------------------------------------------------------------ */

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: ticketStatusEnum("status").notNull().default("open"),
    subject: varchar("subject", { length: 160 }).notNull(),
    escalated: boolean("escalated").notNull().default(false),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("support_tickets_user_idx").on(t.userId, t.updatedAt), index("support_tickets_status_idx").on(t.status, t.escalated)],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    sender: supportSenderEnum("sender").notNull(),
    senderUserId: uuid("sender_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    body: varchar("body", { length: 300 }).notNull(),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 10 }),
    action: varchar("action", { length: 60 }).notNull(),
    targetType: varchar("target_type", { length: 40 }),
    targetId: uuid("target_id"),
    meta: jsonb("meta"),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_target_idx").on(t.targetType, t.targetId), index("audit_logs_created_idx").on(t.createdAt)],
);

/** Login attempts per phone/ip for brute-force protection (works across serverless instances). */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: varchar("key", { length: 120 }).primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  driver: one(drivers, { fields: [users.id], references: [drivers.userId] }),
  sessions: many(sessions),
  notifications: many(notifications),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, { fields: [drivers.userId], references: [users.id] }),
  vehicle: one(vehicles, { fields: [drivers.id], references: [vehicles.driverId] }),
  documents: many(driverDocuments),
  subscriptions: many(subscriptions),
  bids: many(bids),
  rides: many(rides),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  driver: one(drivers, { fields: [vehicles.driverId], references: [drivers.id] }),
}));

export const driverDocumentsRelations = relations(driverDocuments, ({ one }) => ({
  driver: one(drivers, { fields: [driverDocuments.driverId], references: [drivers.id] }),
  file: one(files, { fields: [driverDocuments.fileId], references: [files.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  driver: one(drivers, { fields: [subscriptions.driverId], references: [drivers.id] }),
  receipt: one(files, { fields: [subscriptions.receiptFileId], references: [files.id] }),
}));

export const rideRequestsRelations = relations(rideRequests, ({ one, many }) => ({
  customer: one(users, { fields: [rideRequests.customerId], references: [users.id] }),
  bids: many(bids),
  ride: one(rides, { fields: [rideRequests.rideId], references: [rides.id] }),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  request: one(rideRequests, { fields: [bids.requestId], references: [rideRequests.id] }),
  driver: one(drivers, { fields: [bids.driverId], references: [drivers.id] }),
}));

export const ridesRelations = relations(rides, ({ one, many }) => ({
  request: one(rideRequests, { fields: [rides.requestId], references: [rideRequests.id] }),
  bid: one(bids, { fields: [rides.bidId], references: [bids.id] }),
  customer: one(users, { fields: [rides.customerId], references: [users.id] }),
  driver: one(drivers, { fields: [rides.driverId], references: [drivers.id] }),
  locations: many(rideLocations),
  messages: many(rideMessages),
  ratings: many(ratings),
}));

export const rideLocationsRelations = relations(rideLocations, ({ one }) => ({
  ride: one(rides, { fields: [rideLocations.rideId], references: [rides.id] }),
}));

export const rideMessagesRelations = relations(rideMessages, ({ one }) => ({
  ride: one(rides, { fields: [rideMessages.rideId], references: [rides.id] }),
  sender: one(users, { fields: [rideMessages.senderId], references: [users.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  ride: one(rides, { fields: [ratings.rideId], references: [rides.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportMessages.ticketId], references: [supportTickets.id] }),
}));

export type User = typeof users.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type RideRequest = typeof rideRequests.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;

/**
 * API data-transfer types. These are the JSON shapes the server returns and
 * the mobile/admin clients consume. Keep them serialisable (ISO date strings).
 */
import type {
  BidStatus,
  DocumentType,
  DocumentVerificationStatus,
  DriverStatus,
  RideRequestStatus,
  RideStatus,
  SubscriptionStatus,
  SupportTicketStatus,
  UserRole,
  VehicleCategory,
  PlatformSettings,
} from "./constants";
import type { FareBreakdown } from "./fare";
import type { LatLng } from "./geo";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Place extends LatLng {
  address: string;
  name?: string;
}

export interface UserDto {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  isBlocked: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface AuthResponse {
  user: UserDto;
  driver?: DriverDto | null;
  tokens: AuthTokens;
}

export interface VehicleDto {
  id: string;
  category: VehicleCategory;
  catalogId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  kmPerLitre: number;
  isCustom: boolean;
}

export interface DocumentDto {
  id: string;
  type: DocumentType;
  fileId: string;
  url: string;
  status: DocumentVerificationStatus;
  aiVerdict: DocumentAiVerdict | null;
  reviewerNote: string | null;
  uploadedAt: string;
}

export interface DocumentAiVerdict {
  detectedType: string;
  matchesExpectedType: boolean;
  legible: boolean;
  confidence: number;
  extracted: {
    name?: string | null;
    cnic?: string | null;
    licenseNumber?: string | null;
    expiryDate?: string | null;
    registrationNumber?: string | null;
    vehicleMakeModel?: string | null;
    dateOfBirth?: string | null;
  };
  nameMatchesProfile: boolean | null;
  issues: string[];
  summary: string;
  model: string;
  verifiedAt: string;
}

export interface SubscriptionDto {
  id: string;
  status: SubscriptionStatus;
  amountPkr: number;
  method: string;
  transactionRef: string | null;
  receiptFileId: string;
  receiptUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
}

export interface DriverDto {
  id: string;
  userId: string;
  status: DriverStatus;
  statusReason: string | null;
  cnic: string | null;
  city: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  isOnline: boolean;
  lastLocation: (LatLng & { heading: number | null; updatedAt: string }) | null;
  vehicle: VehicleDto | null;
  documents: DocumentDto[];
  subscription: SubscriptionDto | null;
  subscriptionActive: boolean;
  /** Which onboarding steps are complete, for the wizard. */
  onboarding: {
    details: boolean;
    vehicle: boolean;
    documents: boolean;
    subscription: boolean;
    submitted: boolean;
  };
  totalRides: number;
  totalEarningsPkr: number;
  createdAt: string;
}

export interface DriverPublicDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalRides: number;
  vehicle: Pick<VehicleDto, "category" | "make" | "model" | "color" | "plate" | "year"> | null;
  joinedAt: string;
}

export interface CustomerPublicDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
}

export interface RouteQuote {
  distanceKm: number;
  durationMin: number;
  polyline: string | null;
  geometry: LatLng[];
  source: "osrm" | "estimate";
  fares: Record<VehicleCategory, FareBreakdown>;
}

export interface BidDto {
  id: string;
  requestId: string;
  status: BidStatus;
  amountPkr: number;
  etaMin: number;
  message: string | null;
  driver: DriverPublicDto;
  driverLocation: LatLng | null;
  distanceToPickupKm: number | null;
  expiresAt: string;
  createdAt: string;
}

export interface RideRequestDto {
  id: string;
  status: RideRequestStatus;
  customer: CustomerPublicDto;
  pickup: Place;
  dropoff: Place;
  category: VehicleCategory;
  offeredFarePkr: number;
  minFarePkr: number;
  maxFarePkr: number;
  recommendedFarePkr: number;
  distanceKm: number;
  durationMin: number;
  routePolyline: string | null;
  passengers: number;
  note: string | null;
  bids: BidDto[];
  /** Set when a bid was accepted and a ride was created. */
  rideId: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Slimmer view a driver sees in the incoming-requests feed. */
export interface DriverRequestFeedItem {
  request: Omit<RideRequestDto, "bids">;
  distanceToPickupKm: number;
  etaToPickupMin: number;
  /** Driver-personal fare math using their registered vehicle. */
  economics: FareBreakdown;
  myBid: BidDto | null;
}

export interface RideDto {
  id: string;
  status: RideStatus;
  requestId: string;
  customer: CustomerPublicDto;
  driver: DriverPublicDto;
  pickup: Place;
  dropoff: Place;
  category: VehicleCategory;
  farePkr: number;
  distanceKm: number;
  durationMin: number;
  routePolyline: string | null;
  paymentMethod: "cash";
  driverLocation: (LatLng & { heading: number | null; updatedAt: string }) | null;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: "customer" | "driver" | null;
  myRating: { stars: number; comment: string | null } | null;
  theirRating: { stars: number; comment: string | null } | null;
  unreadMessages: number;
  createdAt: string;
}

export interface ChatMessageDto {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: "customer" | "driver";
  body: string;
  createdAt: string;
}

export interface SupportMessageDto {
  id: string;
  ticketId: string;
  sender: "user" | "assistant" | "admin";
  body: string;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  status: SupportTicketStatus;
  subject: string;
  escalated: boolean;
  messages: SupportMessageDto[];
  user?: UserDto;
  createdAt: string;
  updatedAt: string;
}

export interface DriverEarningsDto {
  todayPkr: number;
  weekPkr: number;
  monthPkr: number;
  totalPkr: number;
  ridesToday: number;
  ridesWeek: number;
  ridesTotal: number;
  acceptanceRate: number;
  ratingAvg: number;
  daily: { date: string; earningsPkr: number; rides: number }[];
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface AdminStatsDto {
  customers: number;
  drivers: number;
  driversOnline: number;
  driversPendingReview: number;
  openRequests: number;
  activeRides: number;
  ridesToday: number;
  ridesWeek: number;
  gmvTodayPkr: number;
  gmvWeekPkr: number;
  subscriptionRevenueMonthPkr: number;
  openTickets: number;
  series: { date: string; rides: number; gmvPkr: number; signups: number }[];
  categoryMix: { category: VehicleCategory; rides: number }[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicConfigDto {
  settings: Pick<
    PlatformSettings,
    | "petrolPricePkr"
    | "driverFlatPkr"
    | "driverSubscriptionPkr"
    | "subscriptionDays"
    | "paymentInstructions"
    | "bidTtlSeconds"
    | "requestTtlSeconds"
    | "supportPhone"
    | "supportEmail"
    | "commissionPercent"
  >;
  serverTime: string;
  minAppVersion: string;
}

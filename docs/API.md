# Raahi API contract (v1)

Base: `https://<server>/api`. JSON in/out. Errors: `{ error: { code, message, details? } }` with proper HTTP status.
Auth: `Authorization: Bearer <accessToken>` (mobile) or `raahi_admin` HttpOnly cookie (admin panel).
All request bodies are validated with the zod schemas in `packages/shared/src/schemas.ts`; all responses use the DTOs in `packages/shared/src/types.ts`.
Every route file exports `OPTIONS` from `@/lib/http` and wraps handlers with `route()` from `@/lib/http`.

## Public
| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | /api/health | – | `{ ok, db: boolean, time }` |
| GET | /api/config | – | `PublicConfigDto` |
| GET | /api/vehicles/catalog | `?category=` | `{ items: VehicleModel[] }` |
| GET | /api/geo/search | `geocodeSearchSchema` (query) | `{ items: PlaceSuggestion[] }` |
| GET | /api/geo/reverse | `reverseGeocodeSchema` (query) | `{ name, address }` |
| POST | /api/geo/route | `quoteSchema` | `RouteQuote` |

## Auth
| POST | /api/auth/signup/customer | `customerSignupSchema` | `AuthResponse` |
| POST | /api/auth/signup/driver | `driverSignupSchema` | `AuthResponse` (driver status `onboarding`) |
| POST | /api/auth/login | `loginSchema` | `AuthResponse` |
| POST | /api/auth/refresh | `refreshSchema` | `{ tokens: AuthTokens }` |
| POST | /api/auth/logout | – (auth) | `{ ok }` revokes current session |
| POST | /api/auth/admin/login | `adminLoginSchema` | `{ user }` + sets `raahi_admin` cookie (also returns tokens) |
| POST | /api/auth/admin/logout | – | `{ ok }` clears cookie |

Login brute-force protection: `assertLoginAllowed/recordLoginFailure/clearLoginFailures` from `@/lib/rate-limit` keyed by `login:<phone|email>` and `ip:<ip>`.

## Me (any authenticated role)
| GET | /api/me | – | `{ user: UserDto, driver: DriverDto|null }` |
| PATCH | /api/me | `updateProfileSchema` | same as GET |
| POST | /api/me/password | `changePasswordSchema` | `{ ok }` (revokes other sessions) |
| GET | /api/me/notifications | `?page&pageSize` | `Paginated<NotificationDto>` + `unread` |
| POST | /api/me/notifications/read | `{ ids?: string[] }` (all when omitted) | `{ ok }` |
| DELETE | /api/me | – | `{ ok }` soft-delete: anonymise + block |

## Files
| POST | /api/files | multipart `file` + `kind` (`avatar|document|receipt`) | `{ file: { id, url, width, height, sizeBytes } }` uses `saveImage` |
| GET | /api/files/[id] | – | image bytes. Public files: anyone. Else owner, the driver's reviewer (admin), or the counterpart in an active/completed ride for avatars. `Cache-Control: private, max-age=3600`. |

## Customer marketplace
| POST | /api/rides/quote | `quoteSchema` | `RouteQuote` |
| POST | /api/requests | `createRideRequestSchema` | `RideRequestDto` |
| GET | /api/requests/active | – | `{ request: RideRequestDto|null, ride: RideDto|null }` (ride = active ride if any) |
| GET | /api/requests/[id] | – | `RideRequestDto` (bids included) |
| PATCH | /api/requests/[id] | `updateOfferSchema` | `RideRequestDto` |
| DELETE | /api/requests/[id] | `cancelRequestSchema` | `RideRequestDto` |
| POST | /api/requests/[id]/accept | `{ bidId }` | `RideDto` |

## Driver
| GET | /api/driver | – | `DriverDto` |
| PUT | /api/driver/details | `driverDetailsSchema` | `DriverDto` |
| PUT | /api/driver/vehicle | `vehicleUpsertSchema` | `DriverDto` (catalog lookup fills kmPerLitre; custom requires kmPerLitre) |
| POST | /api/driver/documents | `attachDocumentSchema` | `DriverDto` → runs `verifyDocument` (Gemini) synchronously, stores verdict, status via `decideStatus` |
| POST | /api/driver/subscription | `subscriptionReceiptSchema` | `DriverDto` (auto-approve when settings.autoApproveSubscriptionReceipts) |
| POST | /api/driver/submit | – | `DriverDto` → status `under_review`; auto-approve if all docs verified AND subscription active |
| POST | /api/driver/presence | `driverPresenceSchema` | `{ online }` |
| POST | /api/driver/location | `locationPingSchema` | `{ activeRideId }` |
| GET | /api/driver/feed | – | `{ items: DriverRequestFeedItem[], online, serverTime }` |
| GET | /api/driver/bids | – | `{ items: BidDto[] }` pending bids |
| POST | /api/driver/requests/[id]/bids | `placeBidSchema` | `BidDto` |
| DELETE | /api/driver/bids/[id] | – | `{ ok }` withdraw |
| GET | /api/driver/earnings | – | `DriverEarningsDto` |

## Rides (customer or driver party)
| GET | /api/rides | `?page&pageSize` | `Paginated<RideDto>` |
| GET | /api/rides/active | – | `{ ride: RideDto|null }` |
| GET | /api/rides/[id] | – | `RideDto` |
| POST | /api/rides/[id]/arrived | – (driver) | `RideDto` |
| POST | /api/rides/[id]/start | – (driver) | `RideDto` |
| POST | /api/rides/[id]/complete | – (driver) | `RideDto` |
| POST | /api/rides/[id]/cancel | `rideCancelSchema` | `RideDto` |
| POST | /api/rides/[id]/rate | `rateRideSchema` | `RideDto` |
| GET | /api/rides/[id]/messages | – | `{ items: ChatMessageDto[] }` (marks read) |
| POST | /api/rides/[id]/messages | `sendMessageSchema` | `ChatMessageDto` |
| GET | /api/rides/[id]/trail | – | `{ points: {lat,lng,heading,recordedAt}[] }` |

## Support (Gemini assistant + human escalation)
| GET | /api/support/tickets | – | `{ items: SupportTicketDto[] }` (user's own) |
| POST | /api/support/messages | `supportMessageSchema` | `text/event-stream` of `data: {"delta":"..."}` lines then `data: {"done":true,"ticketId","messageId"}`. Creates ticket if needed; saves user msg + assistant reply. Non-stream fallback when `Accept: application/json` → `{ ticket: SupportTicketDto }`. |
| POST | /api/support/escalate | `supportEscalateSchema` | `SupportTicketDto` (escalated=true, notify admins) |

## Admin (role admin, cookie or bearer)
| GET | /api/admin/stats | – | `AdminStatsDto` |
| GET | /api/admin/drivers | `paginationSchema` (+status) | `Paginated<DriverDto & { user: UserDto }>` |
| GET | /api/admin/drivers/[id] | – | `DriverDto & { user: UserDto, rides: RideDto[] (last 10), audit: [] }` |
| POST | /api/admin/drivers/[id]/decision | `adminDriverDecisionSchema` | `DriverDto` (+notify driver, audit) |
| POST | /api/admin/documents/[id]/decision | `adminDocumentDecisionSchema` | `DocumentDto` |
| POST | /api/admin/documents/[id]/reverify | – | `DocumentDto` (re-run Gemini) |
| GET | /api/admin/subscriptions | `paginationSchema` | `Paginated<SubscriptionDto & { driver: {id, fullName, phone} }>` |
| POST | /api/admin/subscriptions/[id]/decision | `adminSubscriptionDecisionSchema` | `SubscriptionDto` |
| GET | /api/admin/customers | `paginationSchema` | `Paginated<UserDto & { rides: number }>` |
| POST | /api/admin/users/[id]/action | `adminUserActionSchema` | `UserDto` (block revokes sessions) |
| GET | /api/admin/rides | `paginationSchema` (+status) | `Paginated<RideDto>` |
| GET | /api/admin/rides/live | – | `{ rides: RideDto[], drivers: {id, fullName, lat, lng, heading, category, isOnline}[] , requests: RideRequestDto[] }` |
| GET | /api/admin/requests | `paginationSchema` | `Paginated<RideRequestDto>` |
| GET | /api/admin/settings | – | `PlatformSettings` |
| PUT | /api/admin/settings | `adminSettingsSchema` | `PlatformSettings` |
| GET | /api/admin/support | `paginationSchema` | `Paginated<SupportTicketDto>` (escalated first) |
| POST | /api/admin/support/[id]/reply | `adminReplySchema` | `SupportTicketDto` |
| GET | /api/admin/audit | `paginationSchema` | `Paginated<AuditLog>` |
| GET | /api/admin/fare/preview | `?distanceKm&durationMin&category&petrolPricePkr?` | `FareBreakdown` |

## Polling cadence (mobile)
- Customer waiting for bids: `GET /api/requests/[id]` every 2.5 s.
- Driver online feed: `GET /api/driver/feed` every 3 s; location ping every 5 s (foreground) / 10 s (background during ride).
- Active ride (both sides): `GET /api/rides/[id]` every 3 s.
- Chat open: `GET /api/rides/[id]/messages` every 2 s.
- Notifications badge: every 20 s.

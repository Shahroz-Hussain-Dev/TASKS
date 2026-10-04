import { sql, type SQL } from "drizzle-orm";

/**
 * Date parameters inside raw sql`` templates reach postgres.js without type
 * information and fail to serialise ("Received an instance of Date"). Always
 * pass timestamps through this helper, which binds an ISO string and casts.
 */
export const ts = (d: Date): SQL => sql`${d.toISOString()}::timestamptz`;

interface PgErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/**
 * True when `err` (or anything in its `cause` chain — drizzle wraps driver
 * errors) is a Postgres unique_violation (SQLSTATE 23505), optionally for one
 * specific constraint/index name.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    const e = current as PgErrorLike;
    if (e.code === "23505") return constraint ? e.constraint_name === constraint : true;
    current = e.cause;
  }
  return false;
}

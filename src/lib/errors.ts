/** Errors whose message is safe to show to end users. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "APP_ERROR",
    public status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = "Insufficient balance") {
    super(message, "INSUFFICIENT_FUNDS", 400);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please slow down.") {
    super(message, "RATE_LIMITED", 429);
  }
}

export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string };

export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

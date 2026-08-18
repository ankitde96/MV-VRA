/**
 * PLAN.md §2 — one error class per HTTP outcome, thrown from any layer, caught by a single
 * route wrapper (added when the first API route lands). Never leak `.stack` or internal
 * detail into a response — that formatting lives at the route boundary, not here.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, "validation_error");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "not_found");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, "forbidden");
  }
}

/**
 * Phase 6: OTP verification failure. Deliberately one class/one message for "no such
 * challenge," "expired," "attempt limit reached," and "wrong code" — callers must not be
 * able to distinguish which from the response (`FLOW.md` F2 gap a/c).
 */
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401, "unauthorized");
  }
}

/** Phase 6: OTP request rate limiting (`PLAN.md` Phase 6 item 5). */
export class RateLimitedError extends AppError {
  constructor(message: string) {
    super(message, 429, "rate_limited");
  }
}

/**
 * Thrown when a repository is constructed, or a query executed, without a valid
 * TenantContext. This is not a client error — CONSTRAINTS.md #8 makes a missing tenant
 * filter a security bug, so it surfaces as a 500 and should page someone, not just log.
 */
export class TenantScopeError extends AppError {
  constructor(message: string) {
    super(message, 500, "tenant_scope_error");
  }
}

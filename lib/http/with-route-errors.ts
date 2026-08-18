import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors";

/**
 * PLAN.md §2's "single route wrapper" — the two Phase 2 auth routes predate this and format
 * their own responses by hand (small, already correct, left alone). Every route from Phase
 * 3 on wraps its handler with this instead of repeating the try/catch.
 *
 * An AppError is a known, safe-to-surface outcome (validation, not-found, forbidden) — its
 * message reaches the client. Anything else is unexpected: logged with full detail here
 * (server-side only) and replaced with a generic message before it reaches the response,
 * so a vendor-portal or internal-console client never sees a stack trace or internal detail.
 */
export function withRouteErrors<C = unknown>(
  handler: (request: NextRequest, context: C) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: C): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.statusCode },
        );
      }
      console.error("Unhandled error in route handler", {
        path: request.nextUrl.pathname,
        method: request.method,
        error,
      });
      return NextResponse.json(
        { error: "internal_error", message: "Something went wrong." },
        { status: 500 },
      );
    }
  };
}

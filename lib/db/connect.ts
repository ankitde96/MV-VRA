import mongoose from "mongoose";
import { env } from "@/lib/env";

/**
 * Next.js dev mode reloads this module on every edit-triggered recompile. Without caching
 * the connection promise on `globalThis`, each reload would open a new connection and
 * eventually exhaust the pool — a well-known Next.js + Mongoose pitfall, not a hypothetical.
 */
declare global {
  var __mongooseConnectionPromise: Promise<typeof mongoose> | undefined;
}

/**
 * autoIndex stays on in development (convenient while models are still being shaped) and
 * off in production/test — DATA-MODEL.md §6. Production indexes are applied explicitly via
 * `npm run db:indexes`; an unexpected index build triggered by a live write path is a stall,
 * not a feature. Tests build their own explicit indexes where a test needs them.
 */
function buildConnection(): Promise<typeof mongoose> {
  return mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV === "development",
  });
}

export function dbConnect(): Promise<typeof mongoose> {
  if (!global.__mongooseConnectionPromise) {
    global.__mongooseConnectionPromise = buildConnection();
  }
  return global.__mongooseConnectionPromise;
}

/**
 * Importing this module registers every Mongoose model. Needed by scripts/db-indexes.ts and
 * scripts/seed.ts, which must see every model regardless of which one a given script
 * actually uses.
 */
export * from "./workspace";
export * from "./user";
export * from "./vendor";
export * from "./engagement";
export * from "./questionnaire-template";
export * from "./assessment";
export * from "./response";
export * from "./risk";
export * from "./otp-challenge";
export * from "./offboarding";
export * from "./audit-event";
export * from "./mitigation-guidance";
export * from "./shared-document";

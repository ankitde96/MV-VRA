import { describe, expect, it } from "vitest";
import { getOverdueAgeBucket } from "../vendor-overdue-remediation";

describe("vendor overdue remediation age buckets", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it.each([
    ["2026-08-19T12:00:00.000Z", "1–30"],
    ["2026-07-21T12:00:00.000Z", "1–30"],
    ["2026-07-20T12:00:00.000Z", "31–60"],
    ["2026-06-20T12:00:00.000Z", "61–90"],
    ["2026-05-22T12:00:00.000Z", "61–90"],
    ["2026-05-21T12:00:00.000Z", "90+"],
  ])("classifies %s as %s days overdue", (dueDate, expected) => {
    expect(getOverdueAgeBucket(dueDate, now)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { reviewStateReducer, type ReviewState } from "../review-state";

describe("reviewStateReducer", () => {
  const initialState: ReviewState = {
    "CTRL-1": {
      verdict: null,
      note: "",
      savedAt: null,
      error: false,
    },
    "CTRL-2": {
      verdict: "compliant",
      note: "Existing note",
      savedAt: null,
      error: false,
    },
  };

  it("updates one control without replacing unchanged control state", () => {
    const next = reviewStateReducer(initialState, {
      type: "note_changed",
      controlId: "CTRL-1",
      note: "Needs evidence",
    });

    expect(next["CTRL-1"]?.note).toBe("Needs evidence");
    expect(next["CTRL-2"]).toBe(initialState["CTRL-2"]);
  });

  it("records successful and failed saves", () => {
    const savedAt = new Date("2026-08-20T00:00:00.000Z");
    const failed = reviewStateReducer(initialState, {
      type: "save_failed",
      controlId: "CTRL-1",
    });
    const saved = reviewStateReducer(failed, {
      type: "save_succeeded",
      controlId: "CTRL-1",
      savedAt,
    });

    expect(failed["CTRL-1"]?.error).toBe(true);
    expect(saved["CTRL-1"]).toMatchObject({ savedAt, error: false });
  });

  it("ignores an unknown control", () => {
    expect(
      reviewStateReducer(initialState, {
        type: "verdict_changed",
        controlId: "UNKNOWN",
        verdict: "non_compliant",
      }),
    ).toBe(initialState);
  });
});

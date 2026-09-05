import { describe, expect, it } from "vitest";
import { missingFields, nextState } from "@/lib/onboarding/state-machine";

describe("onboarding state machine", () => {
  it("starts with language", () => expect(nextState("NOT_STARTED", {})).toBe("LANGUAGE"));

  it("moves through basic profile when complete", () => {
    expect(nextState("BASIC_PROFILE", { age: 27, height_cm: 181, weight_kg: 82 })).toBe("FITNESS_PROFILE");
  });

  it("reports missing basic fields", () => {
    expect(missingFields("BASIC_PROFILE", { age: 27 })).toEqual(["height_cm", "weight_kg"]);
  });

  it("moves to review after preferences", () => expect(nextState("PREFERENCES", {})).toBe("REVIEW"));
});

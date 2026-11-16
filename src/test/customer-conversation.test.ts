import { describe, expect, it } from "vitest";
import { DEVICE_MAX_AGE, parseCustomerCredentials, resolutionOutcome, selectProductOffer } from "@/lib/customer-conversation";
import { INTERNAL_KB } from "@/lib/kindred-kb.server";

describe("customer recognition and resolution", () => {
  it("requires both identity and code", () => {
    expect(parseCustomerCredentials("0123454821 code 4821")).toEqual({ identity: "0123454821", code: "4821" });
    expect(parseCustomerCredentials("0123454821")).toBeNull();
    expect(parseCustomerCredentials("08012345678 4821")).toEqual({ identity: "08012345678", code: "4821" });
  });
  it("expires remembered greetings after thirty days", () => expect(DEVICE_MAX_AGE).toBe(2592000));
  it("offers only a product absent from recorded holdings using approved terms", () => {
    expect(selectProductOffer(["Everyday Savings"], INTERNAL_KB)?.product).toBe("Goal Saver");
    expect(selectProductOffer(["Goal Saver"], INTERNAL_KB)?.product).toBe("Fixed Deposit");
    expect(selectProductOffer(["Goal Saver", "Fixed Deposit"], INTERNAL_KB)).toBeNull();
    expect(selectProductOffer([], INTERNAL_KB)).toBeNull();
  });
  it("closes attended resolved requests", () => expect(resolutionOutcome("answered", false)).toBe("closed"));
  it("never closes unresolved or escalated requests", () => {
    expect(resolutionOutcome("pending", false)).toBe("open");
    expect(resolutionOutcome("escalated", false)).toBe("open");
    expect(resolutionOutcome("answered", true)).toBe("open");
  });
});
import { describe, it, expect } from "vitest";
import { parseBalanceCredentials, isBalanceRequest, maskDigits } from "@/lib/public-voice-policy";
describe("balance verification", () => {
  it("reads account number and code", () => expect(parseBalanceCredentials("0123454821 code 4821")).toEqual({ account: "0123454821", code: "4821" }));
  it("reads spoken split digits", () => expect(parseBalanceCredentials("0123 454 821 4821")).toEqual({ account: "0123454821", code: "4821" }));
  it("rejects incomplete", () => expect(parseBalanceCredentials("4821")).toBeNull());
  it("detects balance request", () => expect(isBalanceRequest("What is my account balance?")).toBe(true));
  it("masks digits", () => expect(maskDigits("a 12")).toBe("a ••"));
});

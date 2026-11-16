import { describe, it, expect } from "vitest";
import { upsellLine } from "@/lib/customer-conversation";
import { friendlyOpeningError } from "@/lib/account-opening";
describe("upsell after answers", () => {
  it("offers a product not yet discussed", () => expect(upsellLine("Tell me about Goal Saver")).toContain("Fixed Deposit"));
  it("skips products the customer owns", () => expect(upsellLine("", ["Goal Saver"])).toContain("Fixed Deposit"));
});
describe("account opening errors", () => {
  it("turns validation JSON into plain words", () => {
    const msg = friendlyOpeningError(new Error(JSON.stringify([{ path: ["bvn"], message: "Invalid string" }])));
    expect(msg).toBe("Please check: BVN (11 digits).");
  });
});
describe("returning-customer upsell reason", () => {
  it("explains Goal Saver fit using Ada's balance", () => {
    const line = upsellLine("", ["Everyday Savings"], { firstName: "Adaeze", balance: 5000 });
    expect(line).toContain("Why it fits you: Adaeze, with ₦5,000 already in your Everyday Savings");
  });
});
import { offeredOpenableProduct } from "@/lib/account-opening";
describe("open-account button for upsell", () => {
  it("detects an openable offered product", () => expect(offeredOpenableProduct("You may also like: Goal Saver helps…")).toBe("Goal Saver"));
  it("shows no button for loans", () => expect(offeredOpenableProduct("You may also like: SME Growth Loan offers…")).toBeNull());
});

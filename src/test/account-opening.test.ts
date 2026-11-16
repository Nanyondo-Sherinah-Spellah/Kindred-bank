import { describe, it, expect } from "vitest";
import { applicationSchema, isOpeningRequest } from "../lib/account-opening";
const doc = { name: "sample.pdf", type: "application/pdf", data: "JVBERi0xLjQ=" };
const valid = {
  full_name: "Sample Person",
  email: "sample@example.com",
  phone: "+2348000001001",
  fictional: true,
  simulated_email: true,
  dob: "1997-03-14",
  gender: "Female",
  bvn: "22000000001",
  nin: "70000000001",
  id_type: "National ID",
  id_number: "70000000001",
  birthplace: "Lagos",
  address: "Sample address",
  occupation: "Teacher",
  employer: "Sample school",
  source_of_funds: "Salary",
  monthly_income: 120000,
  next_of_kin: "Sample brother",
  accounts: [{ product: "Everyday Savings", deposit: 5000 }],
  documents: Object.fromEntries(
    ["Government ID", "Passport photograph", "Signature", "Proof of address"].map((k) => [k, doc]),
  ),
};
describe("fictional opening rules", () => {
  it("rejects real customer submission", () =>
    expect(applicationSchema.safeParse({ ...valid, fictional: false }).success).toBe(false));
  it("requires all four sample documents", () =>
    expect(applicationSchema.safeParse({ ...valid, documents: {} }).success).toBe(false));
  it("opens an account without an email address", () =>
    expect(applicationSchema.safeParse({ ...valid, email: "" }).success).toBe(true));
  it("accepts an Everyday Savings test application", () =>
    expect(applicationSchema.parse(valid).accounts[0]?.deposit).toBe(5000));
  it("requires child details and a birth certificate for Kids Saver", () =>
    expect(
      applicationSchema.safeParse({ ...valid, accounts: [{ product: "Kids Saver", deposit: 500 }] })
        .success,
    ).toBe(false));
  it("requires tax ID and referees for Current Account", () =>
    expect(
      applicationSchema.safeParse({
        ...valid,
        accounts: [{ product: "Current Account", deposit: 50000 }],
      }).success,
    ).toBe(false));
  it("routes a customer request to self service", () =>
    expect(isOpeningRequest("I want to open a bank account")).toBe(true));
});

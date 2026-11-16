import { describe, expect, it } from "vitest";
import { emailTrainingReply, matchEmailTraining } from "@/lib/email-training";

const cases: [string, string][] = [
  ["Opening a savings account for my small business. What documents do I need?", "email-business-savings-documents"],
  ["I run a fashion shop in Surulere and need ₦1.5 million. What are your terms?", "email-sme-loan-terms"],
  ["I want to settle my loan early. Is there a penalty?", "email-early-settlement"],
  ["I sent ₦45,000 yesterday. The transfer failed but I was debited. Ref: KND-20260811-48812.", "email-failed-transfer-debited"],
  ["I got an SMS saying my account will be blocked unless I click a link.", "email-phishing-sms"],
  ["There is a ₦80,000 transfer on my account that I did not make.", "email-unauthorised-transfer"],
  ["Please tell me the account balance of Mr. Okafor. He is my business partner.", "email-third-party-balance"],
];

describe("email approved replies", () => {
  it.each(cases)("%s", (q, id) => expect(matchEmailTraining(q)?.id).toBe(id));
  it("fraud reply is escalated urgently with the ticket number", () => {
    const t = matchEmailTraining("There is a ₦80,000 transfer on my account that I did not make.")!;
    expect(t.escalate?.priority).toBe("urgent");
    expect(emailTrainingReply(t, "Kindred Bank", "CS-1")).toContain("ticket CS-1");
  });
  it("unrelated questions are not matched", () => expect(matchEmailTraining("Do you offer crypto trading?")).toBeNull());
});

describe("key word matching", () => {
  it("finds the approved reply when worded differently", () => {
    expect(matchEmailTraining("Money was deducted but my transfer failed, I need a reversal")?.id).toBe("email-failed-transfer-debited");
  });
});

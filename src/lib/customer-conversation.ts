export const DEVICE_MAX_AGE = 30 * 24 * 60 * 60;

export function parseCustomerCredentials(text: string) {
  const numbers = text.match(/\d+/g) ?? [];
  const code = numbers.find((n) => n.length === 4);
  const identity = numbers.find((n) => n.length >= 10 && n.length <= 15);
  return code && identity ? { identity, code } : null;
}

export function selectProductOffer(owned: string[], approved: { topic: string; approved_answer: string }[]) {
  if (!owned.length) return null; // No complete product record: do not guess what the customer owns.
  const candidates = [
    { product: "Goal Saver", topic: "Savings accounts", extract: (s: string) => s.match(/Goal Saver:[^.]+(?:\.[0-9]+)?[^.]*\./)?.[0] },
    { product: "Fixed Deposit", topic: "Fixed deposit", extract: (s: string) => s },
  ];
  for (const candidate of candidates) {
    if (owned.some((p) => p.toLowerCase() === candidate.product.toLowerCase())) continue;
    const row = approved.find((r) => r.topic === candidate.topic);
    const detail = row && candidate.extract(row.approved_answer);
    if (detail) return { product: candidate.product, detail };
  }
  return null;
}

export function resolutionOutcome(state: string, escalate: boolean) {
  return !escalate && (state === "answered" || state === "resolved") ? "closed" : "open";
}
// Approved one-line product summaries (from the internal knowledge base) used for upselling after an answer.
export const UPSELL_PRODUCTS = [
  { product: "Goal Saver", match: /goal saver/i, line: "Goal Saver helps you save towards a target from ₦5,000 at 6.0% p.a., paid at maturity, with a 3–12 month lock." },
  { product: "Fixed Deposit", match: /fixed deposit/i, line: "Fixed Deposit grows ₦100,000 or more at up to 13.0% p.a., depending on tenure." },
  { product: "Kids Saver", match: /kids saver/i, line: "Kids Saver lets you save for a child from just ₦500 at 5.0% p.a." },
  { product: "SME Growth Loan", match: /sme growth/i, line: "SME Growth Loan offers ₦100,000 to ₦5,000,000 for 3–18 months at 3.0% monthly on a reducing balance." },
  { product: "Kindred Mobile App", match: /mobile app/i, line: "The Kindred Mobile App and USSD *347*88# let you bank any time, day or night." },
];

/** Picks one product the customer doesn't own and hasn't already heard about in this conversation. */
export type CustomerProfile = { firstName: string; balance: number | null };
const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
/** Why a product suits this returning customer, built only from their own records. */
export function upsellReason(product: string, owned: string[], p: CustomerProfile) {
  const has = owned.length ? `your ${owned.join(" and ")}` : "your account";
  const bal = p.balance ?? 0;
  switch (product) {
    case "Goal Saver":
      return bal >= 5000
        ? `${p.firstName}, with ${naira(bal)} already in ${has}, you meet the ₦5,000 minimum today. Moving part of it into a Goal Saver would earn more than everyday savings and keep it set aside for something you're working towards.`
        : `${p.firstName}, since you already save with ${has}, a Goal Saver gives those savings a clear target and a higher return once you reach the ₦5,000 minimum.`;
    case "Fixed Deposit":
      return bal >= 100000
        ? `${p.firstName}, your balance of ${naira(bal)} already meets the ₦100,000 minimum, so money you don't need right away could earn one of our highest rates.`
        : `${p.firstName}, as your savings in ${has} grow towards ₦100,000, a Fixed Deposit is the natural next step to earn our highest rates.`;
    case "Kids Saver":
      return `${p.firstName}, you're already a saver with ${has}; if you have a child in your life, a Kids Saver helps you start their savings habit early.`;
    case "SME Growth Loan":
      return `${p.firstName}, as an existing customer with ${has}, you already have a banking history with us that can support a business loan application.`;
    default:
      return `${p.firstName}, this lets you check ${has} and bank with us any time without visiting a branch.`;
  }
}
export function upsellLine(conversation: string, owned: string[] = [], profile?: CustomerProfile) {
  const ownedLower = owned.map((p) => p.toLowerCase());
  const pick = UPSELL_PRODUCTS.find((p) => !p.match.test(conversation) && !ownedLower.includes(p.product.toLowerCase()));
  if (!pick) return "Is there anything else you'd like to ask?";
  const why = profile ? ` Why it fits you: ${upsellReason(pick.product, owned, profile)}` : "";
  return `You may also like: ${pick.line}${why} Would you like to know more, or is there anything else you'd like to ask?`;
}

import { bestKeywordMatch } from "./keyword-match";
// Approved email replies supplied by the bank for specific customer questions.
// Matched replies are sent as written; "{ref}" is replaced with the case/ticket reference.

export type EmailTraining = {
  id: string;
  topic: string;
  match: RegExp[]; // every pattern must match
  keywords: string[]; // key words used when the wording differs
  answer: string;
  escalate?: { category: string; priority: "low" | "medium" | "high" | "urgent"; reason: string };
};

export const EMAIL_TRAINING: EmailTraining[] = [
  {
    id: "email-third-party-balance",
    keywords: ["balance of","account balance","his account","her account","business partner","another customer","someone else"],
    topic: "Another customer's account details",
    match: [/\b(balance|account details?|account number|statement)\b/i, /\b(mr|mrs|ms|my (business )?partner|my (husband|wife|brother|sister|friend)|of (another|someone)|his|her)\b/i],
    answer: "We are sorry, but we cannot share any customer's account details, including balances, with anyone else. We handle customer data under the Nigeria Data Protection Act. The account holder is welcome to contact us himself or herself, and we would be happy to help you with your own account.",
  },
  {
    id: "email-unauthorised-transfer",
    keywords: ["did not make","didn't make","unauthorised","unauthorized","not me","strange debit","unknown transaction"],
    topic: "Unauthorised transaction",
    match: [/\b(transfer|debit|transaction|withdrawal)\b/i, /\b(did ?n[o']?t make|not make|didn'?t authori[sz]e|unauthori[sz]ed|not me|i did not do)\b/i],
    answer: "We are treating this as urgent. Please block your card now (in the app or by dialling *347*88*0#) and change your app password. We have escalated this transaction to our fraud team under ticket {ref}, and a member of the team will contact you personally. Do not share any code with anyone.",
    escalate: { category: "Suspected fraud", priority: "urgent", reason: "Customer reported a transaction they did not make — fraud team to contact customer" },
  },
  {
    id: "email-phishing-sms",
    keywords: ["sms","click a link","link","blocked","suspicious message","scam","phishing"],
    topic: "Suspicious SMS or link",
    match: [/\b(sms|text message|message|email)\b/i, /\b(link|click)\b/i, /\b(block|blocked|suspend|deactivat|verify)/i],
    answer: "Thank you for checking first. That message is not from Kindred. We never ask you to click a link, or share your PIN, OTP, password or full card number. Please do not click it, and forward it to fraud@kindredmfb.example. If you already clicked it or shared details, reply straight away so our fraud team can act.",
  },
  {
    id: "email-failed-transfer-debited",
    keywords: ["transfer failed","failed transfer","debited","deducted","reversal","not received"],
    topic: "Failed transfer but debited",
    match: [/\b(transfer|transaction|payment)\b/i, /\b(fail|failed|unsuccessful|did ?n[o']?t go)/i, /\b(debit|debited|deducted|charged|removed)/i],
    answer: "We are sorry about this. We have logged ticket {ref} for your transfer. Failed transfers are reversed automatically within 24 hours. If it is not reversed after 24 hours, reply to this email and we will escalate it.",
    escalate: { category: "Failed transfer", priority: "medium", reason: "Customer debited for a failed transfer — monitor automatic reversal within 24 hours" },
  },
  {
    id: "email-early-settlement",
    keywords: ["settle my loan","early settlement","pay off","settle early","liquidate loan","penalty"],
    topic: "Early loan settlement",
    match: [/\b(loan)\b/i, /\b(early|before (the )?(due|end)|settle|pay ?off|liquidat)/i],
    answer: "There is no penalty for early settlement, and interest is charged only up to the settlement date. To get your settlement figure, please reply with your full name and loan repayment account number so we can verify you. Please never include your PIN, OTP or password.",
  },
  {
    id: "email-sme-loan-terms",
    keywords: ["sme loan","business loan","shop","need million","loan terms","borrow"],
    topic: "SME Growth Loan terms",
    match: [/\b(shop|business|trade|store|sme)\b/i, /(need|want|borrow|loan|terms)/i, /(₦|naira|million|\bn\s?\d|\d[\d,.]*\s*(m|million|k)\b)/i],
    answer: "Your request fits our SME Growth Loan (₦100,000 to ₦5,000,000, 3 to 18 months). The rate is 3% a month on a reducing balance, plus a 1.5% management fee (for example, ₦22,500 on ₦1.5 million). You need your business registration or trade association letter, 6 months of statements and one guarantor. Reply if you would like to start the application.",
  },
  {
    id: "email-business-savings-documents",
    keywords: ["open account","savings account","documents","requirements","small business account"],
    topic: "Opening a savings account — documents",
    match: [/\b(open|opening|start)\b/i, /\b(savings|account)\b/i, /\b(document|requirement|need|bring)/i],
    answer: "Thank you for choosing Kindred. You need a valid ID, your BVN and a passport photo, and you can open your account in the Kindred app, with an agent or at a branch. Everyday Savings opens with ₦1,000. Reply to this email if you would like help choosing the right account.",
  },
];

export function matchEmailTraining(text: string): EmailTraining | null {
  return EMAIL_TRAINING.find((t) => t.match.every((re) => re.test(text)))
    ?? bestKeywordMatch(text, EMAIL_TRAINING, (t) => ({ keywords: t.keywords }), 4);
}

export function emailTrainingReply(t: EmailTraining, bank: string, ref: string) {
  const body = t.answer.replaceAll("{ref}", ref);
  return `Hello,\n\n${body}\n\nWarm regards,\n${bank} Customer Care\nCase reference: ${ref}`;
}

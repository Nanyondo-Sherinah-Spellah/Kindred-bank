// Server-only AI customer service engine.
// The AI classifies intent, language and question type and picks a knowledge entry;
// customer-facing text is composed here from approved answers and fixed, reviewed
// phrases only, so the model can never invent policy and every channel answers alike.
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id";
import { PHRASES, type Lang, type TimeOfDay } from "./lang";

export type Intent =
  | "general"
  | "personal_account"
  | "complaint"
  | "fraud"
  | "missing_funds"
  | "greeting"
  | "thanks"
  | "farewell"
  | "unknown";

export type KnowledgeRow = {
  id: string;
  topic: string;
  keywords: string[];
  approved_answer: string;
  category: string;
};

export type AnswerType = "yes_no" | "explanation" | "clarify";

export type Classification = {
  intent: Intent;
  knowledgeId: string | null;
  summary: string;
  engine: "ai" | "keyword-fallback";
  note?: string | undefined;
  language?: Lang | "unsupported";
  answerType?: AnswerType;
  yesNo?: "yes" | "no" | "unconfirmed" | null;
  clarifyOptions?: string[];
  emotion?: "neutral" | "frustrated" | "worried";
  greeted?: TimeOfDay | null;
};

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev";

const schema = z.object({
  intent: z.enum(["general", "personal_account", "complaint", "fraud", "missing_funds", "greeting", "thanks", "farewell", "unknown"]),
  knowledge_id: z.string().nullable(),
  summary: z.string(),
  language: z.enum(["en", "pcm", "yo", "ig", "ha", "unsupported"]),
  language_confidence: z.enum(["high", "low"]),
  answer_type: z.enum(["yes_no", "explanation", "clarify"]),
  yes_no: z.enum(["yes", "no", "unconfirmed"]).nullable(),
  clarify_options: z.array(z.string()),
  emotion: z.enum(["neutral", "frustrated", "worried"]),
  greeting: z.enum(["morning", "afternoon", "evening", "none"]).nullable(),
});

const PERSONAL = [
  /\bmy (next )?(repayment|payment|loan|balance|account|instal?lment|statement|savings)\b/i,
  /\b(how much do i owe|when (is|do) (my|i)|loan status|account balance|my due date)\b/i,
];
const FRAUD = [/\b(fraud|scam|hack(ed)?|stolen|unauthori[sz]ed|phishing|someone used my)\b/i];
const MISSING = [/\b(missing (money|funds)|money (is )?missing|funds? (is |are )?missing|didn'?t receive|not (been )?credited|disappeared)\b/i];
const COMPLAINT = [/\b(complain(t)?|terrible|unacceptable|angry|disappointed|rude|poor service|worst)\b/i];

export function keywordMatch(text: string, kb: KnowledgeRow[]): KnowledgeRow | null {
  const t = text.toLowerCase();
  let best: { row: KnowledgeRow; score: number } | null = null;
  for (const row of kb) {
    let score = 0;
    for (const k of row.keywords) if (k && t.includes(k.toLowerCase())) score += k.split(" ").length + 1;
    if (t.includes(row.topic.toLowerCase())) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }
  return best?.row ?? null;
}

function guardIntent(text: string): Intent | null {
  if (FRAUD.some((r) => r.test(text))) return "fraud";
  if (MISSING.some((r) => r.test(text))) return "missing_funds";
  if (PERSONAL.some((r) => r.test(text))) return "personal_account";
  if (COMPLAINT.some((r) => r.test(text))) return "complaint";
  return null;
}

export function detectGreeting(text: string): TimeOfDay | null {
  const t = text.trim().toLowerCase();
  if (/^(good morning|morning|ina kwana|ẹ káàárọ̀|e kaaro|ututu oma|ụtụtụ ọma)/i.test(t)) return "morning";
  if (/^(good afternoon|barka da rana|ẹ káàsán|e kaasan|ehihie oma|ehihie ọma)/i.test(t)) return "afternoon";
  if (/^(good evening|barka da yamma|ẹ kú ìrọ̀lẹ́|e kurole|mgbede oma|mgbede ọma)/i.test(t)) return "evening";
  if (/^(hi|hello|hey|how far|sannu|ndewo|ẹ n lẹ́|e nle)\b/i.test(t)) return "none";
  return null;
}

function fallbackClassify(text: string, kb: KnowledgeRow[], prevLang: Lang | undefined, note?: string): Classification {
  const base = { engine: "keyword-fallback" as const, note, language: prevLang ?? ("en" as Lang), answerType: "explanation" as AnswerType, yesNo: null, clarifyOptions: [], emotion: "neutral" as const, greeted: detectGreeting(text) };
  const guard = guardIntent(text);
  if (guard) return { ...base, intent: guard, knowledgeId: null, summary: text.slice(0, 160) };
  const m = keywordMatch(text, kb);
  if (m) return { ...base, intent: "general", knowledgeId: m.id, summary: `Question about ${m.topic.toLowerCase()}` };
  if (/^\s*(thanks|thank you|thank u)\b/i.test(text)) return { ...base, intent: "thanks", knowledgeId: null, summary: "Thanks" };
  if (base.greeted && text.trim().split(/\s+/).length <= 4) return { ...base, intent: "greeting", knowledgeId: null, summary: "Greeting" };
  return { ...base, intent: "unknown", knowledgeId: null, summary: text.slice(0, 160) };
}

export async function classify(text: string, kb: KnowledgeRow[], prevLang?: Lang, history: { role: string; text: string }[] = []): Promise<Classification> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return fallbackClassify(text, kb, prevLang, "AI key missing; used keyword matching");

  const kbList = kb.map((k) => `- id: ${k.id} | topic: ${k.topic}\n  approved text: ${k.approved_answer}`).join("\n");
  const instructions = `You are the analysis step of Kindred Bank's customer service assistant (a Nigerian microfinance bank).
You never write the reply. You only analyse the customer's message and return structured fields.

intent:
- general: a question about bank products, fees, branches, hours, procedures (not about the customer's own account).
- personal_account: asks about THEIR OWN balance, repayment date/amount, loan status, statement or account details.
- complaint: dissatisfaction with service. fraud: suspected fraud/scam/unauthorised transaction/hacked account.
- missing_funds: money missing, not credited, disappeared.
- greeting: only a greeting or pleasantry with no question. thanks: only thanks. farewell: only goodbye.
- unknown: anything else, or a question the knowledge base cannot answer.

knowledge_id: set ONLY if an entry's approved text clearly answers the question; otherwise null. Never guess.

answer_type (only meaningful for general):
- yes_no: the customer asks a closed question ("Can I...", "Do I need...", "Is ... required", "Una dey...", "Ṣé...", "Shin...").
- clarify: the question is broad or ambiguous and several different entries or products could apply (e.g. "I want to know about your loans", "tell me about accounts"). Do not clarify when the question is already specific.
- explanation: otherwise.

yes_no: when answer_type is yes_no, answer from the chosen entry's approved text ONLY:
"yes" if the text explicitly supports yes, "no" if it explicitly supports no, otherwise "unconfirmed". null otherwise.

clarify_options: when answer_type is clarify, 2 to 4 short options (max 6 words each, in English) naming products or topics that appear in the approved texts. Otherwise [].

language: the customer's language: en (English, including Nigerian English), pcm (Nigerian Pidgin), yo (Yoruba), ig (Igbo), ha (Hausa), unsupported (any other language).
language_confidence: low when the message is too short or mixed to tell (e.g. only digits, "ok", a name).
Previous language in this conversation: ${prevLang ?? "none"}.

emotion: frustrated or worried if the customer expresses frustration, anger, fear or concern; otherwise neutral.
greeting: if the message opens with a greeting, its time of day (morning/afternoon/evening) or "none" for a plain hello; null if no greeting.
summary: one neutral English sentence (max 20 words) describing the request, without personal data.

Follow-up questions: the customer may refer to earlier turns ("what about the interest?", "how long does it take?", "and for business?"). Resolve the follow-up using the earlier conversation below, then pick the knowledge entry that answers the resolved question. If no approved entry answers the resolved question, intent is unknown so a human handles it.
Earlier conversation (oldest first):
${history.slice(-6).map((h) => `${h.role}: ${h.text.slice(0, 400)}`).join("\n") || "(none)"}

Knowledge base:
${kbList || "(empty)"}`;

  try {
    const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
    const provider = createOpenAI({
      baseURL: `${GATEWAY}/v1`,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const result = streamText({
      model: provider.responses(MODEL),
      instructions,
      messages: [{ role: "user", content: text }],
      output: Output.object({ schema }),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low" } },
    } as Parameters<typeof streamText>[0]);
    const out = (await result.output) as z.infer<typeof schema>;
    const validId = out.knowledge_id && kb.some((k) => k.id === out.knowledge_id) ? out.knowledge_id : null;
    let intent: Intent = out.intent;
    // Deterministic rules can only make the outcome safer, never less safe.
    const guard = guardIntent(text);
    if (guard && ["general", "unknown", "greeting", "thanks", "farewell"].includes(intent)) intent = guard;
    let language: Lang | "unsupported" = out.language;
    if (out.language_confidence === "low" && prevLang) language = prevLang;
    if (out.language_confidence === "low" && !prevLang && language === "unsupported") language = "en";
    return {
      intent,
      knowledgeId: intent === "general" ? validId : null,
      summary: out.summary.slice(0, 240),
      engine: "ai",
      language,
      answerType: out.answer_type,
      yesNo: out.answer_type === "yes_no" ? out.yes_no ?? "unconfirmed" : null,
      clarifyOptions: out.clarify_options.slice(0, 4).map((s) => s.slice(0, 60)),
      emotion: out.emotion,
      greeted: out.greeting ?? detectGreeting(text),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("AI classify failed:", msg);
    return fallbackClassify(text, kb, prevLang, `AI unavailable (${msg.slice(0, 120)}); used keyword matching`);
  }
}

export function caseRef() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `CS-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export type Decision = {
  action: "answer" | "clarify" | "redirect_private" | "escalate" | "greet" | "verify";
  response: string;
  language: Lang;
  escalate: null | { category: string; priority: "low" | "medium" | "high" | "urgent"; reason: string };
};

export type Channel = "email" | "social" | "voice" | "whatsapp";

const TIME_RE = /\d{1,2}(:\d{2})?\s?(am|pm)\b/i;
export const TZ_NOTE = "All times are Nigerian time (WAT).";

function joinList(items: string[], or: string) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${or} ${items[items.length - 1]}`;
}

export function decide(
  c: Classification,
  kb: KnowledgeRow[],
  channel: Channel,
  opts: { bank: string; secure: string; ref: string },
): Decision {
  const lang: Lang = c.language && c.language !== "unsupported" ? c.language : "en";
  const P = PHRASES[lang];
  const entry = c.knowledgeId ? kb.find((k) => k.id === c.knowledgeId) : null;
  const note = P.englishNote ? `${P.englishNote} ` : "";
  const empathy = c.emotion && c.emotion !== "neutral" ? `${P.empathy} ` : "";
  const greetPrefix = c.greeted && c.intent !== "greeting" ? `${P.tod[c.greeted]}, ${P.shortWelcome} ` : "";
  const approved = (a: string) => (TIME_RE.test(a) ? `${a} ${TZ_NOTE}` : a);

  const wrap = (body: string) =>
    channel === "email"
      ? lang === "en"
        ? `Hello,\n\nThank you for reaching out to ${opts.bank}. I'm ${opts.bank}'s virtual assistant, and I'm glad to help.\n\n${body}\n\nWarm regards,\n${opts.bank} Customer Care\nCase reference: ${opts.ref}`
        : `${body}\n\n${opts.bank} Customer Care\nCase reference: ${opts.ref}`
      : body;
  const out = (action: Decision["action"], body: string, escalate: Decision["escalate"] = null): Decision => ({
    action,
    response: wrap(`${greetPrefix}${body}`.trim()),
    language: lang,
    escalate,
  });
  const humanEsc = (reason: string, category = "Unanswered question") =>
    out("escalate", P.human(opts.ref), { category, priority: "medium", reason });

  if (c.language === "unsupported") {
    return {
      action: "escalate",
      language: "en",
      response: wrap(`I'm sorry — I can currently help in English, Nigerian Pidgin, Yoruba, Igbo and Hausa, and I couldn't understand your message confidently enough to answer accurately. I've asked one of our colleagues to assist you. Your case reference is ${opts.ref}.`),
      escalate: { category: "Language not supported", priority: "low", reason: "Customer wrote in a language the assistant cannot handle reliably" },
    };
  }

  switch (c.intent) {
    case "general": {
      if (c.answerType === "clarify") {
        const options = c.clarifyOptions ?? [];
        return out("clarify", options.length >= 2 ? P.clarify(joinList(options, P.or)) : P.clarifyOpen);
      }
      if (!entry) return humanEsc("No approved answer in knowledge base");
      const a = approved(entry.approved_answer);
      if (c.answerType === "yes_no") {
        if (c.yesNo === "yes") return out("answer", `${P.yes} ${note}${a} ${P.offerMore}`);
        if (c.yesNo === "no") return out("answer", `${P.no} ${note}${a} ${P.offerMore}`);
        return out("answer", `${P.unconfirmed} ${note}${a} ${P.offerHuman}`);
      }
      return out("answer", `${P.helpLead} ${note}${a} ${P.offerMore}`);
    }
    case "personal_account":
      if (channel === "voice")
        return out("verify", `${P.helpLead} ${note}Before I share anything personal, please provide your demonstration verification code.`);
      if (channel === "social")
        return out("redirect_private", `${P.helpLead} ${note}For your security, we cannot discuss personal repayment information publicly. Please send us a private message or contact our customer support team through ${opts.secure}, and we'll gladly assist you there.`);
      return out("redirect_private", `${P.helpLead} ${note}For your security, we can't share personal account or repayment details over ${channel === "whatsapp" ? "WhatsApp chat" : "email"}. Please contact our customer support team through ${opts.secure}, where we can verify your identity and assist you.`, { category: "Personal account enquiry", priority: "low", reason: `Personal enquiry received by ${channel}; requires verified follow-up` });
    case "fraud":
      return out("escalate", `${PHRASES[lang].empathy} ${note}Thank you for alerting us. Your report has been passed urgently to our security team, who will contact you through ${opts.secure}. Please do not share your PIN, OTP or passwords with anyone. Your case reference is ${opts.ref}.`, { category: "Suspected fraud", priority: "urgent", reason: "Customer reported possible fraud" });
    case "missing_funds":
      return out("escalate", `${PHRASES[lang].empathy} ${note}Your report has been passed to our support team for investigation, and they will contact you through ${opts.secure}. Your case reference is ${opts.ref}.`, { category: "Missing funds", priority: "high", reason: "Customer reported missing money" });
    case "complaint":
      return out("escalate", `${empathy || `${P.empathy} `}${note}Your feedback matters to us, and I've passed it to a member of our customer support team, who will follow up with you personally. Your case reference is ${opts.ref}.`, { category: "Complaint", priority: "high", reason: "Customer complaint requires human review" });
    case "greeting":
      return out("greet", `${P.tod[c.greeted ?? "none"]}! ${P.welcome}`);
    case "thanks":
      return out("greet", P.thanks);
    case "farewell":
      return out("greet", P.farewell);
    default:
      return humanEsc("Intent could not be handled automatically", "Requires human judgement");
  }
}

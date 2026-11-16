import type { Classification, Decision, KnowledgeRow } from "./engine.server";
import { PHRASES, type Lang } from "./lang";
import { bestKeywordMatch } from "./keyword-match";

// Exact question first, otherwise the approved question whose key words clearly fit what was said.
// Worked examples (fixed amounts) are only used for exact questions.
export function smartVoiceQuestion(text: string, rows: VoiceTraining[], language?: string) {
  const exact = exactVoiceQuestion(text, rows);
  if (exact) return exact;
  const usable = rows.filter((r) => r.topic !== "Fixed deposit example");
  const pick = (lang: string) => bestKeywordMatch(text, usable.filter((r) => r.language === lang), (r) => ({ keywords: r.keywords, question: r.question }), 4);
  return (language && language !== "en" ? pick(language) : null) ?? pick("en") ?? undefined;
}

export type VoiceTraining = {
  id: string; question: string; language: string; approved_answer: string;
  topic: string; keywords: string[]; intent: string; sort_order: number;
};

const normalize = (text: string) => text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function exactVoiceQuestion(text: string, rows: VoiceTraining[]) {
  return rows.find((row) => normalize(row.question) === normalize(text));
}

export function voiceKnowledge(rows: VoiceTraining[]): KnowledgeRow[] {
  return rows.filter((row) => row.intent === "general" && row.language === "en").map((row) => ({
    id: row.id, topic: row.topic, keywords: row.keywords,
    approved_answer: row.approved_answer, category: "Voice training",
  }));
}

export function trainingClassification(row: VoiceTraining, language: Lang): Classification {
  const intent = row.intent === "fraud" || row.intent === "missing_funds" || row.intent === "complaint" || row.intent === "personal_account" ? row.intent : "general";
  return { intent, knowledgeId: row.id, summary: `Question about ${row.topic}`, engine: "keyword-fallback", language, answerType: "explanation" };
}

// Only reviewed source text is spoken; safety actions are never replaced by a general answer.
export function voiceTrainingDecision(text: string, c: Classification, rows: VoiceTraining[], language: Lang, ref: string): Decision | null {
  const exact = exactVoiceQuestion(text, rows);
  const smart = exact ?? smartVoiceQuestion(text, rows, language);
  const row = smart ?? rows.find((r) => r.id === c.knowledgeId && r.intent === "general" && c.intent === "general");
  if (!row) return null;
  // A worked example is not a calculator for other amounts or durations.
  if (row.topic === "Fixed deposit example" && !exact) return null;
  if (row.intent === "general" && c.intent !== "general") return null;
  const localized = rows.find((r) => r.language === language && r.topic.replace(/ in Pidgin$/, "") === row.topic.replace(/ in Pidgin$/, ""));
  const chosen = localized ?? row;
  const prefix = chosen.language !== language && language !== "en" ? `${PHRASES[language].englishNote} ` : "";
  const escalate = row.intent === "fraud" || row.intent === "missing_funds" || row.intent === "complaint"
    ? { category: row.topic, priority: row.intent === "fraud" ? "urgent" as const : "high" as const, reason: `Voice report: ${row.topic}` }
    : row.intent === "personal_account"
      ? { category: "Personal account enquiry", priority: "low" as const, reason: "Balance access is not available in the demonstration" }
      : null;
  return {
    action: escalate ? "escalate" : "answer", language, escalate,
    response: `${prefix}${chosen.approved_answer.replaceAll("{ref}", ref)}`,
  };
}
import type { Lang } from "./lang";

export type SuggestedQuestion = { id: string; question: string; language: string; category: string };

export function questionsInLanguage<T extends SuggestedQuestion>(questions: T[], language: Lang, category?: string) {
  return questions.filter((q) => q.language === language && (category === undefined || q.category === category));
}
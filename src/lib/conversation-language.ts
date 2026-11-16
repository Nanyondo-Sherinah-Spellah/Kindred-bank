import type { Lang } from "./lang";

export const LANGUAGE_LOCALE: Record<Lang, string> = { en: "en-NG", pcm: "en-NG", ha: "ha-NG", ig: "ig-NG", yo: "yo-NG" };
export const SATISFACTION: Record<Lang, string> = {
  en: "Are you satisfied with this response?", pcm: "Are you satisfied with this response?",
  ha: "Shin ka gamsu da wannan amsar?", ig: "Afọ juru gị na azịza a?", yo: "Ṣé ìdáhùn yìí tẹ́ yín lọ́rùn?",
};
export const FEEDBACK_LABELS: Record<Lang, { yes: string; no: string }> = {
  en: { yes: "Yes", no: "No" }, pcm: { yes: "Yes", no: "No" },
  ha: { yes: "Eh", no: "A'a" }, ig: { yes: "Ee", no: "Mba" }, yo: { yes: "Bẹ́ẹ̀ni", no: "Rárá" },
};
export const SUGGESTION_LABELS: Record<Lang, { choose: string; questions: string; more: string; categories: string[] }> = {
  en: { choose: "Choose a category for your request", questions: "Suggested questions", more: "You might want to ask:", categories: ["Products (Savings)", "Products (Loan)", "Bank profile, Contact and Hours", "Fees, Cards & Tiers", "Policies", "Complaints"] },
  pcm: { choose: "Wetin your question concern?", questions: "Wetin you wan ask?", more: "You fit ask one of these:", categories: ["Savings products", "Loan products", "About bank, contact and opening time", "Charges, cards and account levels", "Bank rules", "Complaints"] },
  ha: { choose: "Zaɓi rukunin tambayarka", questions: "Tambayoyin da aka ba da shawara", more: "Za ka iya tambaya:", categories: ["Kayayyakin ajiya", "Lamuni", "Bayanin banki, tuntuɓa da lokutan aiki", "Kuɗaɗen caji, katuna da matakan asusu", "Dokokin banki", "Ƙorafe-ƙorafe"] },
  ig: { choose: "Họrọ ụdị ajụjụ gị", questions: "Ajụjụ ndị a tụrụ aro", more: "Ị nwere ike ịjụ:", categories: ["Ngwaahịa nchekwa ego", "Mbinye ego", "Banyere ụlọ akụ, kọntaktị na oge ọrụ", "Ụgwọ, kaadị na ọkwa akaụntụ", "Iwu ụlọ akụ", "Mkpesa"] },
  yo: { choose: "Ẹ yan ẹ̀ka ìbéèrè yín", questions: "Àwọn ìbéèrè tí a dábàá", more: "Ẹ lè béèrè pé:", categories: ["Àwọn ètò ìfipamọ́", "Àwọn ètò awin", "Nípa ilé ìfowópamọ́, ìkàn sí wa àti àkókò iṣẹ́", "Owó iṣẹ́, káàdì àti ìpele àkáǹtì", "Àwọn ìlànà ilé ìfowópamọ́", "Ẹ̀dùn ọkàn"] },
};
export function feedbackAnswer(text: string): boolean | null {
  const t = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/[.!?]+$/, "");
  if (/^(yes|yeah|yep|yes o|i am|i'm satisfied|eh|ee|beeni)$/.test(t)) return true;
  if (/^(no|nope|nah|no o|no thanks|no thank you|a['’]?a|mba|rara)$/.test(t)) return false;
  return null;
}

/** Replace values with immutable placeholders so translation cannot alter fees, codes or names. */
export function protectTranslationValues(source: string) {
  const values: string[] = [];
  const text = source.replace(/(?:Kindred Bank|Quick Salary Advance|SME Growth Loan|Everyday Savings|Current Account|Kids Saver|Goal Saver|Fixed Deposit|Asset Finance|Education Loan|Group Loan)|CS-[A-Z0-9-]+|[\w.+-]+@[\w.-]+|(?:₦|UGX\s*)?\d[\d,.]*(?:%|\+)?|\*\d[\d*]*#/g, (value) => {
    const token = `__VALUE_${values.length}__`; values.push(value); return token;
  });
  return { text, values };
}
export function restoreTranslationValues(translated: string, values: string[]) {
  for (let index = 0; index < values.length; index++) {
    const token = `__VALUE_${index}__`;
    if (translated.split(token).length !== 2) throw new Error("Translation changed a protected bank value");
  }
  const remaining = translated.replace(/__VALUE_\d+__/g, "");
  if (/\d|₦|%/.test(remaining)) throw new Error("Translation added an unapproved number");
  return translated.replace(/__VALUE_(\d+)__/g, (_, index: string) => {
    const value = values[Number(index)];
    if (value === undefined) throw new Error("Unknown translation value");
    return value;
  });
}
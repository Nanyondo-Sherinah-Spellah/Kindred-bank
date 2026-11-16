// Picks the approved answer whose key words best fit what the customer said.
const STOP = new Set("a an the i my me we you your is are am was do does did can could would should to of for in on at and or but it this that with please what how when where why which is there have has be".split(" "));

export const normalizeText = (t: string) => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}₦]+/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (t: string) => normalizeText(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");

export function keywordScore(text: string, keywords: string[], question = ""): number {
  const norm = ` ${normalizeText(text)} `;
  const said = new Set(tokens(text).map(stem));
  let score = 0;
  for (const k of keywords) {
    const kn = normalizeText(k);
    if (!kn) continue;
    if (norm.includes(` ${kn} `)) score += kn.includes(" ") ? 3 : 2;
    else if (kn.split(" ").every((w) => said.has(stem(w)))) score += 1.5;
  }
  const q = tokens(question).map(stem);
  if (q.length) score += (q.filter((w) => said.has(w)).length / q.length) * 3;
  return score;
}

export function bestKeywordMatch<T>(text: string, rows: T[], get: (r: T) => { keywords: string[]; question?: string }, min = 3): T | null {
  let best: T | null = null, top = 0, second = 0;
  for (const r of rows) {
    const { keywords, question } = get(r);
    const s = keywordScore(text, keywords, question);
    if (s > top) { second = top; top = s; best = r; } else if (s > second) second = s;
  }
  // Require a clear winner so an ambiguous request is clarified or escalated, never guessed.
  return best && top >= min && top - second >= 1 ? best : null;
}

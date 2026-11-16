type BrowserVoice = { name: string; lang: string; default: boolean };

// Web Speech has no gender field: use explicitly labelled voices and known
// provider voice names, never infer gender from arbitrary personal names.
export function isKnownFemaleVoice(voice: BrowserVoice) {
  return /\bfemale\b|\b(Ezinne|Sonia|Susan|Hazel|Zira|Aria|Jenny|Samantha|Victoria|Karen|Moira|Tessa|Fiona)\b/i.test(voice.name);
}

export function isNigerianVoice(voice: BrowserVoice) {
  return /^en[-_]NG$/i.test(voice.lang);
}

export function preferredBrowserVoice<T extends BrowserVoice>(voices: T[]): T | null {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  return english.find((voice) => isNigerianVoice(voice) && isKnownFemaleVoice(voice))
    ?? english.find(isKnownFemaleVoice)
    ?? english.find(isNigerianVoice)
    ?? english.find((voice) => voice.default)
    ?? english[0]
    ?? null;
}
// Fixed, reviewed conversational phrases per language. Bank policy text is never
// machine-translated: approved answers stay in their original English wording.
export type Lang = "en" | "pcm" | "yo" | "ig" | "ha";
export const LANGS: Lang[] = ["en", "pcm", "yo", "ig", "ha"];
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  pcm: "Nigerian Pidgin",
  yo: "Yoruba",
  ig: "Igbo",
  ha: "Hausa",
};
export type TimeOfDay = "morning" | "afternoon" | "evening" | "none";

type Pack = {
  tod: Record<TimeOfDay, string>;
  welcome: string; // follows the time-of-day greeting
  shortWelcome: string; // prefix when greeting + question
  helpLead: string;
  clarify: (list: string) => string;
  clarifyOpen: string;
  yes: string;
  no: string;
  unconfirmed: string;
  offerMore: string;
  offerHuman: string;
  englishNote: string;
  empathy: string;
  thanks: string;
  farewell: string;
  human: (ref: string) => string;
  or: string;
};

export const PHRASES: Record<Lang, Pack> = {
  en: {
    tod: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", none: "Hello" },
    welcome: "Welcome to Kindred Bank — it's lovely to have you here. I'm Kindred Bank's virtual assistant. How may I assist you today?",
    shortWelcome: "and welcome to Kindred Bank!",
    helpLead: "I'd be happy to help with that.",
    clarify: (l) => `I'd be happy to help with that. So I can give you the right information, are you asking about ${l}?`,
    clarifyOpen: "I'd be happy to help. Could you tell me a little more about what you'd like to know?",
    yes: "Yes.",
    no: "No.",
    unconfirmed: "I'm not able to confirm a simple yes or no on that from our approved information.",
    offerMore: "Would you like me to explain anything else about this?",
    offerHuman: "Would you like me to connect you with one of our colleagues to confirm?",
    englishNote: "",
    empathy: "I'm really sorry about this, and I understand how worrying it can be.",
    thanks: "You're very welcome! Is there anything else I can help you with today?",
    farewell: "Thank you for banking with Kindred Bank. Have a wonderful day!",
    human: (r) => `I'm sorry — I don't have approved information to answer that accurately, and I wouldn't want to guess. I've passed your enquiry to one of our colleagues, who will get back to you. Your case reference is ${r}.`,
    or: "or",
  },
  pcm: {
    tod: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", none: "How far" },
    welcome: "You welcome to Kindred Bank — we happy to see you. Na me be Kindred Bank virtual assistant. How I fit help you today?",
    shortWelcome: "you welcome to Kindred Bank!",
    helpLead: "I go happy help you with am.",
    clarify: (l) => `I go happy help you. Abeg, so I go give you correct information, na ${l} you dey ask about?`,
    clarifyOpen: "I go happy help you. Abeg, tell me small more about wetin you wan know.",
    yes: "Yes.",
    no: "No.",
    unconfirmed: "I no fit confirm yes or no for this one from the information wey bank don approve.",
    offerMore: "You wan make I explain anything else about am?",
    offerHuman: "You wan make I connect you with one of our staff make dem confirm am?",
    englishNote: "Make I give you the exact information wey bank approve, for English so the details go correct:",
    empathy: "Sorry well well for this wahala, I understand say e fit worry you.",
    thanks: "You welcome! Anything else wey I fit help you with?",
    farewell: "Thank you as you dey bank with Kindred Bank. Enjoy your day!",
    human: (r) => `Sorry, I no get approved information to answer this one correct, and I no wan guess. I don pass your matter give one of our staff wey go reach you. Your case reference na ${r}.`,
    or: "or",
  },
  yo: {
    tod: { morning: "Ẹ káàárọ̀", afternoon: "Ẹ káàsán", evening: "Ẹ kú ìrọ̀lẹ́", none: "Ẹ n lẹ́" },
    welcome: "Ẹ káàbọ̀ sí Kindred Bank. Èmi ni olùrànlọ́wọ́ orí ẹ̀rọ (virtual assistant) ti Kindred Bank. Báwo ni mo ṣe lè ràn yín lọ́wọ́ lónìí?",
    shortWelcome: "ẹ káàbọ̀ sí Kindred Bank!",
    helpLead: "Inú mi yóò dùn láti ràn yín lọ́wọ́.",
    clarify: (l) => `Inú mi yóò dùn láti ràn yín lọ́wọ́. Ẹ jọ̀wọ́, ṣé nípa ${l} ni ẹ ń béèrè?`,
    clarifyOpen: "Inú mi yóò dùn láti ràn yín lọ́wọ́. Ẹ jọ̀wọ́, ẹ sọ díẹ̀ sí i nípa ohun tí ẹ fẹ́ mọ̀.",
    yes: "Bẹ́ẹ̀ni.",
    no: "Rárá.",
    unconfirmed: "Mi ò lè fìdí bẹ́ẹ̀ni tàbí rárá múlẹ̀ lórí èyí láti inú ìwífún tí ilé-ìfowópamọ́ fọwọ́ sí.",
    offerMore: "Ṣé ẹ fẹ́ kí n ṣàlàyé nǹkan mìíràn nípa èyí?",
    offerHuman: "Ṣé ẹ fẹ́ kí n so yín pọ̀ mọ́ ọ̀kan nínú àwọn òṣìṣẹ́ wa láti fìdí rẹ̀ múlẹ̀?",
    englishNote: "Èyí ni ìwífún gangan tí ilé-ìfowópamọ́ fọwọ́ sí, ní èdè Gẹ̀ẹ́sì kí àwọn àlàyé má baà yí padà:",
    empathy: "Ẹ má bínú gidigidi, mo mọ̀ pé èyí lè kó ìdààmú bá yín.",
    thanks: "Kò tọ́pẹ́! Ṣé ohun mìíràn wà tí mo lè bá yín ṣe?",
    farewell: "Ẹ ṣé tí ẹ ń bá Kindred Bank ṣiṣẹ́. Ẹ ní ọjọ́ àtàtà!",
    human: (r) => `Ẹ má bínú, mi ò ní ìwífún tí a fọwọ́ sí láti dáhùn èyí dáadáa, mi ò sì fẹ́ fojú dá a. Mo ti fi ọ̀rọ̀ yín ránṣẹ́ sí ọ̀kan nínú àwọn òṣìṣẹ́ wa, tí yóò kàn sí yín. Nọ́mbà ìtọ́kasí yín ni ${r}.`,
    or: "tàbí",
  },
  ig: {
    tod: { morning: "Ụtụtụ ọma", afternoon: "Ehihie ọma", evening: "Mgbede ọma", none: "Ndewo" },
    welcome: "Nnọọ na Kindred Bank. Abụ m onye enyemaka dijitalụ (virtual assistant) nke Kindred Bank. Kedu ka m ga-esi nyere gị aka taa?",
    shortWelcome: "nnọọ na Kindred Bank!",
    helpLead: "Obi ga-adị m ụtọ inyere gị aka.",
    clarify: (l) => `Obi ga-adị m ụtọ inyere gị aka. Biko, ọ bụ maka ${l} ka ị na-ajụ?`,
    clarifyOpen: "Obi ga-adị m ụtọ inyere gị aka. Biko, gwakwuo m ihe ị chọrọ ịmata.",
    yes: "Ee.",
    no: "Mba.",
    unconfirmed: "Enweghị m ike ikwenye ee ma ọ bụ mba n'okwu a site n'ozi ụlọ akụ kwadoro.",
    offerMore: "Ị chọrọ ka m kọwaa ihe ọzọ banyere nke a?",
    offerHuman: "Ị chọrọ ka m jikọọ gị na otu n'ime ndị ọrụ anyị ka ha kwenye ya?",
    englishNote: "Nke a bụ ozi ụlọ akụ kwadoro kpọmkwem, n'asụsụ Bekee ka nkọwa ya ghara ịgbanwe:",
    empathy: "Ndo nke ukwuu, aghọtara m na nke a nwere ike inye gị nchegbu.",
    thanks: "Ọ dị mma! Ọ nwere ihe ọzọ m nwere ike inyere gị aka?",
    farewell: "Daalụ maka iso Kindred Bank. Nwee ụbọchị ọma!",
    human: (r) => `Ndo, enweghị m ozi a kwadoro iji zaa nke a nke ọma, achọghịkwa m ịkọ nkọ. Ezigara m okwu gị otu n'ime ndị ọrụ anyị, onye ga-akpọtụrụ gị. Nọmba ntụaka gị bụ ${r}.`,
    or: "ma ọ bụ",
  },
  ha: {
    tod: { morning: "Ina kwana", afternoon: "Barka da rana", evening: "Barka da yamma", none: "Sannu" },
    welcome: "Barka da zuwa Kindred Bank. Ni ne mataimaki na zamani (virtual assistant) na Kindred Bank. Ta yaya zan iya taimaka maka yau?",
    shortWelcome: "barka da zuwa Kindred Bank!",
    helpLead: "Zan yi farin cikin taimaka maka.",
    clarify: (l) => `Zan yi farin cikin taimaka maka. Don Allah, game da ${l} kake tambaya?`,
    clarifyOpen: "Zan yi farin cikin taimaka maka. Don Allah, ƙara min bayani kan abin da kake son sani.",
    yes: "Eh.",
    no: "A'a.",
    unconfirmed: "Ba zan iya tabbatar da eh ko a'a a kan wannan ba daga bayanan da banki ya amince da su.",
    offerMore: "Kana son in ƙara bayani kan wani abu game da wannan?",
    offerHuman: "Kana son in haɗa ka da ɗaya daga cikin ma'aikatanmu don su tabbatar?",
    englishNote: "Ga ainihin bayanin da banki ya amince da shi, cikin Turanci don kada cikakkun bayanai su canza:",
    empathy: "Yi haƙuri sosai, na fahimci cewa wannan zai iya damun ka.",
    thanks: "Babu komai! Akwai wani abu kuma da zan iya taimaka maka da shi?",
    farewell: "Mun gode da kasancewa tare da Kindred Bank. Ka yi rana mai kyau!",
    human: (r) => `Yi haƙuri, ba ni da bayanin da aka amince da shi don amsa wannan daidai, kuma ba na son yin zato. Na tura batunka zuwa ɗaya daga cikin ma'aikatanmu, wanda zai tuntuɓe ka. Lambar shaidar ƙarar ka ita ce ${r}.`,
    or: "ko",
  },
};

export const BANK_TZ = "Africa/Lagos";

export function bankTimeOfDay(now = new Date()): TimeOfDay {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: BANK_TZ }).format(now));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

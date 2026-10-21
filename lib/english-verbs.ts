// English verb forms, for the code's checks of generated sentences: which
// words are a past or a past participle, and whether a reference has the
// form of the tense it was asked for.
import type { Tense } from "@/lib/options";

// The common irregular verbs, in American English: base, simple past, past
// participle (gotten, not got).
const IRREGULAR_VERBS: [string, string, string][] = [
  ["be", "was were", "been"],
  ["beat", "beat", "beaten"],
  ["become", "became", "become"],
  ["begin", "began", "begun"],
  ["bend", "bent", "bent"],
  ["bet", "bet", "bet"],
  ["bite", "bit", "bitten"],
  ["blow", "blew", "blown"],
  ["break", "broke", "broken"],
  ["bring", "brought", "brought"],
  ["build", "built", "built"],
  ["burn", "burned burnt", "burned burnt"],
  ["buy", "bought", "bought"],
  ["catch", "caught", "caught"],
  ["choose", "chose", "chosen"],
  ["come", "came", "come"],
  ["cost", "cost", "cost"],
  ["cut", "cut", "cut"],
  ["deal", "dealt", "dealt"],
  ["dig", "dug", "dug"],
  ["do", "did", "done"],
  ["draw", "drew", "drawn"],
  ["dream", "dreamed dreamt", "dreamed dreamt"],
  ["drink", "drank", "drunk"],
  ["drive", "drove", "driven"],
  ["eat", "ate", "eaten"],
  ["fall", "fell", "fallen"],
  ["feed", "fed", "fed"],
  ["feel", "felt", "felt"],
  ["fight", "fought", "fought"],
  ["find", "found", "found"],
  ["fit", "fit", "fit"],
  ["fly", "flew", "flown"],
  ["forbid", "forbade", "forbidden"],
  ["forget", "forgot", "forgotten"],
  ["forgive", "forgave", "forgiven"],
  ["freeze", "froze", "frozen"],
  ["get", "got", "gotten got"],
  ["give", "gave", "given"],
  ["go", "went", "gone"],
  ["grow", "grew", "grown"],
  ["hang", "hung", "hung"],
  ["have", "had", "had"],
  ["hear", "heard", "heard"],
  ["hide", "hid", "hidden"],
  ["hit", "hit", "hit"],
  ["hold", "held", "held"],
  ["hurt", "hurt", "hurt"],
  ["keep", "kept", "kept"],
  ["know", "knew", "known"],
  ["lay", "laid", "laid"],
  ["lead", "led", "led"],
  ["learn", "learned learnt", "learned learnt"],
  ["leave", "left", "left"],
  ["lend", "lent", "lent"],
  ["let", "let", "let"],
  ["lie", "lay", "lain"],
  ["light", "lit lighted", "lit lighted"],
  ["lose", "lost", "lost"],
  ["make", "made", "made"],
  ["mean", "meant", "meant"],
  ["meet", "met", "met"],
  ["pay", "paid", "paid"],
  ["prove", "proved", "proven proved"],
  ["put", "put", "put"],
  ["quit", "quit", "quit"],
  ["read", "read", "read"],
  ["ride", "rode", "ridden"],
  ["ring", "rang", "rung"],
  ["rise", "rose", "risen"],
  ["run", "ran", "run"],
  ["say", "said", "said"],
  ["see", "saw", "seen"],
  ["seek", "sought", "sought"],
  ["sell", "sold", "sold"],
  ["send", "sent", "sent"],
  ["set", "set", "set"],
  ["shake", "shook", "shaken"],
  ["shine", "shone shined", "shone shined"],
  ["shoot", "shot", "shot"],
  ["show", "showed", "shown showed"],
  ["shut", "shut", "shut"],
  ["sing", "sang", "sung"],
  ["sink", "sank", "sunk"],
  ["sit", "sat", "sat"],
  ["sleep", "slept", "slept"],
  ["slide", "slid", "slid"],
  ["speak", "spoke", "spoken"],
  ["spend", "spent", "spent"],
  ["spill", "spilled spilt", "spilled spilt"],
  ["split", "split", "split"],
  ["spread", "spread", "spread"],
  ["stand", "stood", "stood"],
  ["steal", "stole", "stolen"],
  ["stick", "stuck", "stuck"],
  ["sting", "stung", "stung"],
  ["strike", "struck", "struck"],
  ["swear", "swore", "sworn"],
  ["sweep", "swept", "swept"],
  ["swim", "swam", "swum"],
  ["swing", "swung", "swung"],
  ["take", "took", "taken"],
  ["teach", "taught", "taught"],
  ["tear", "tore", "torn"],
  ["tell", "told", "told"],
  ["think", "thought", "thought"],
  ["throw", "threw", "thrown"],
  ["understand", "understood", "understood"],
  ["wake", "woke", "woken"],
  ["wear", "wore", "worn"],
  ["win", "won", "won"],
  ["write", "wrote", "written"],
];

const words = (forms: string) => forms.split(" ");
const PASTS = new Set(IRREGULAR_VERBS.flatMap(([, past]) => words(past)));
const PARTICIPLES = new Set(IRREGULAR_VERBS.flatMap(([, , participle]) => words(participle)));

// Every form of a verb: its base, -s, -ing and past forms, regular or not
// (keep: keeps, keeping, kept). Some -ing and -ed spellings (stopping) are
// left out: the checks also accept a word that starts with the base.
export function verbForms(base: string) {
  const irregular = IRREGULAR_VERBS.find(([verb]) => verb === base);
  const stem = base.replace(/e$/, "");
  return new Set([
    base,
    /(s|sh|ch|x|o)$/.test(base) ? `${base}es` : /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ies` : `${base}s`,
    `${stem}ing`,
    ...(irregular
      ? [...words(irregular[1]), ...words(irregular[2])]
      : [/[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ied` : `${stem}ed`]),
  ]);
}

// A past participle: irregular (seen, gotten) or regular (-ed).
function isParticiple(word: string) {
  return PARTICIPLES.has(word) || (word.length > 3 && word.endsWith("ed"));
}

// The words of an English sentence, lowercase, with its contractions split
// off: 's (is or has) and 'd (had or would) stay as they are, since only the
// next words tell them apart.
function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/n't\b/g, " not")
    .replace(/'ve\b/g, " have")
    .replace(/'ll\b/g, " will")
    .replace(/'(s|d)\b/g, " '$1")
    .split(/[^a-z']+/)
    .filter(Boolean);
}

// Whether an auxiliary of the given words comes before a participle, with at
// most three words between them (a subject in a question, not, already):
// "had to" is a modal, never a past perfect.
function perfect(words: string[], auxiliaries: string[]) {
  return words.some(
    (word, index) =>
      auxiliaries.includes(word) &&
      words
        .slice(index + 1, index + 5)
        .some((next, offset, after) => isParticiple(next) && !after.slice(0, offset + 1).includes("to")),
  );
}

// Whether a reference has a form of the tense asked for. Loose on purpose:
// it only rejects a reference with none of the tense's forms (a present
// perfect without have or has and a participle). The present has no form
// of its own to look for.
export function hasTenseForm(reference: string, tense: Tense) {
  const words = tokens(reference);
  const has = (...forms: string[]) => words.some((word) => forms.includes(word));
  switch (tense) {
    case "present perfect":
      return perfect(words, ["have", "has", "'s"]);
    case "past perfect":
      return perfect(words, ["had", "'d"]);
    case "future":
      return has("will", "shall") || /\bgoing to\b/.test(words.join(" "));
    case "conditional":
      return has("would", "could", "might", "should", "'d");
    case "past":
      return (
        has("was", "were", "did", "used") ||
        words.some((word) => PASTS.has(word) || (word.length > 3 && word.endsWith("ed")))
      );
    case "present":
      return true;
  }
}

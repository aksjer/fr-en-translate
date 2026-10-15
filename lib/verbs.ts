import type { Level, VerbType } from "@/lib/options";

// English verbs by type and by the CEFR level learners usually learn them at,
// in American English. The code picks one and the model only translates it:
// asked to choose a verb itself, the model kept writing a sentence instead.
// Verbs that look like their French translation (decide, prefer) are left out,
// and so are false friends: asked for "pretend", the model gave « prétendre »,
// which means to claim (achieve, argue, resent, deliver… are the same trap).
const IRREGULAR: Record<Level, string[]> = {
  A1: ["be", "have", "do", "go", "come", "eat", "drink", "see", "make", "get", "give", "take", "write", "read", "sleep", "buy", "sit", "speak", "swim", "run"],
  A2: ["begin", "bring", "choose", "drive", "fall", "feel", "find", "forget", "hear", "know", "leave", "lose", "meet", "pay", "put", "sell", "send", "sing", "teach", "tell", "think", "understand", "wear", "win"],
  B1: ["bend", "bite", "blow", "break", "build", "catch", "dig", "draw", "feed", "fight", "fly", "freeze", "grow", "hang", "hide", "hold", "hurt", "keep", "lend", "let", "light", "ride", "ring", "shake", "shine", "shoot", "shut", "spend", "steal", "throw"],
  B2: ["bet", "bleed", "burst", "creep", "deal", "flee", "forbid", "forgive", "grind", "kneel", "lay", "lead", "mislead", "overcome", "seek", "shrink", "sink", "slide", "spin", "spit", "split", "spread", "stick", "sting", "strike", "swear", "sweep", "swing", "tear", "weep"],
  C1: ["arise", "bind", "cling", "dwell", "fling", "foresee", "forgo", "forsake", "outgrow", "overhear", "override", "oversee", "overtake", "overthrow", "sling", "sow", "stride", "strive", "thrust", "tread", "undergo", "undertake", "uphold", "weave", "withdraw", "withhold", "withstand", "wring"],
  C2: ["abide", "beset", "forswear", "inlay", "rend", "shear", "slay", "slit", "strew", "swell", "unbind", "waylay", "bind", "cling", "forsake", "thrust", "tread", "withstand", "wring"],
};

const REGULAR: Record<Level, string[]> = {
  A1: ["work", "play", "like", "love", "live", "watch", "listen", "walk", "want", "cook", "clean", "open", "close", "help", "start", "call", "talk", "wash", "stay"],
  A2: ["ask", "borrow", "travel", "carry", "enjoy", "finish", "hope", "look", "miss", "move", "need", "remember", "try", "wait", "worry", "push", "pull", "laugh", "cry", "learn"],
  B1: ["allow", "avoid", "complain", "breathe", "earn", "fail", "hurry", "improve", "notice", "offer", "promise", "share", "suggest", "wonder", "warn", "apologize", "belong", "manage", "rely", "follow"],
  B2: ["swallow", "scratch", "attempt", "claim", "encourage", "shiver", "owe", "rescue", "grumble", "struggle", "threaten", "urge", "bother", "blame", "cheat", "hesitate", "obey", "regret", "tease", "whisper"],
  C1: ["acknowledge", "convey", "deter", "enhance", "hinder", "jeopardize", "mitigate", "overlook", "postpone", "reassure", "dread", "scrutinize", "undermine", "weigh", "dwindle", "foster", "hamper", "loom", "thrive", "yearn"],
  C2: ["appease", "ascertain", "placate", "relinquish", "reprimand", "belittle", "bolster", "cajole", "dither", "flout", "goad", "rebuke", "scold", "squander", "thwart", "wane", "wheedle", "wield"],
};

// Past simple and past participle of each irregular verb above, in American
// English (gotten, spit). A slash gives two forms in common use.
const IRREGULAR_FORMS: Record<string, [string, string]> = {
  be: ["was/were", "been"], have: ["had", "had"], do: ["did", "done"], go: ["went", "gone"],
  come: ["came", "come"], eat: ["ate", "eaten"], drink: ["drank", "drunk"], see: ["saw", "seen"],
  make: ["made", "made"], get: ["got", "gotten"], give: ["gave", "given"], take: ["took", "taken"],
  write: ["wrote", "written"], read: ["read", "read"], sleep: ["slept", "slept"],
  buy: ["bought", "bought"], sit: ["sat", "sat"], speak: ["spoke", "spoken"],
  swim: ["swam", "swum"], run: ["ran", "run"],
  begin: ["began", "begun"], bring: ["brought", "brought"], choose: ["chose", "chosen"],
  drive: ["drove", "driven"], fall: ["fell", "fallen"], feel: ["felt", "felt"],
  find: ["found", "found"], forget: ["forgot", "forgotten"], hear: ["heard", "heard"],
  know: ["knew", "known"], leave: ["left", "left"], lose: ["lost", "lost"], meet: ["met", "met"],
  pay: ["paid", "paid"], put: ["put", "put"], sell: ["sold", "sold"], send: ["sent", "sent"],
  sing: ["sang", "sung"], teach: ["taught", "taught"], tell: ["told", "told"],
  think: ["thought", "thought"], understand: ["understood", "understood"],
  wear: ["wore", "worn"], win: ["won", "won"],
  bend: ["bent", "bent"], bite: ["bit", "bitten"], blow: ["blew", "blown"],
  break: ["broke", "broken"], build: ["built", "built"], catch: ["caught", "caught"],
  dig: ["dug", "dug"], draw: ["drew", "drawn"], feed: ["fed", "fed"], fight: ["fought", "fought"],
  fly: ["flew", "flown"], freeze: ["froze", "frozen"], grow: ["grew", "grown"],
  hang: ["hung", "hung"], hide: ["hid", "hidden"], hold: ["held", "held"], hurt: ["hurt", "hurt"],
  keep: ["kept", "kept"], lend: ["lent", "lent"], let: ["let", "let"], light: ["lit", "lit"],
  ride: ["rode", "ridden"], ring: ["rang", "rung"], shake: ["shook", "shaken"],
  shine: ["shone", "shone"], shoot: ["shot", "shot"], shut: ["shut", "shut"],
  spend: ["spent", "spent"], steal: ["stole", "stolen"], throw: ["threw", "thrown"],
  bet: ["bet", "bet"], bleed: ["bled", "bled"], burst: ["burst", "burst"],
  creep: ["crept", "crept"], deal: ["dealt", "dealt"], flee: ["fled", "fled"],
  forbid: ["forbade", "forbidden"], forgive: ["forgave", "forgiven"],
  grind: ["ground", "ground"], kneel: ["knelt/kneeled", "knelt/kneeled"], lay: ["laid", "laid"],
  lead: ["led", "led"], mislead: ["misled", "misled"], overcome: ["overcame", "overcome"],
  seek: ["sought", "sought"], shrink: ["shrank", "shrunk"], sink: ["sank", "sunk"],
  slide: ["slid", "slid"], spin: ["spun", "spun"], spit: ["spit/spat", "spit/spat"],
  split: ["split", "split"], spread: ["spread", "spread"], stick: ["stuck", "stuck"],
  sting: ["stung", "stung"], strike: ["struck", "struck"], swear: ["swore", "sworn"],
  sweep: ["swept", "swept"], swing: ["swung", "swung"], tear: ["tore", "torn"],
  weep: ["wept", "wept"],
  arise: ["arose", "arisen"], bind: ["bound", "bound"], cling: ["clung", "clung"],
  dwell: ["dwelt/dwelled", "dwelt/dwelled"], fling: ["flung", "flung"],
  foresee: ["foresaw", "foreseen"], forgo: ["forwent", "forgone"],
  forsake: ["forsook", "forsaken"], outgrow: ["outgrew", "outgrown"],
  overhear: ["overheard", "overheard"], override: ["overrode", "overridden"],
  oversee: ["oversaw", "overseen"], overtake: ["overtook", "overtaken"],
  overthrow: ["overthrew", "overthrown"], sling: ["slung", "slung"], sow: ["sowed", "sown"],
  stride: ["strode", "stridden"], strive: ["strove", "striven"], thrust: ["thrust", "thrust"],
  tread: ["trod", "trodden"], undergo: ["underwent", "undergone"],
  undertake: ["undertook", "undertaken"], uphold: ["upheld", "upheld"],
  weave: ["wove", "woven"], withdraw: ["withdrew", "withdrawn"],
  withhold: ["withheld", "withheld"], withstand: ["withstood", "withstood"],
  wring: ["wrung", "wrung"],
  abide: ["abided/abode", "abided/abode"], beset: ["beset", "beset"],
  forswear: ["forswore", "forsworn"], inlay: ["inlaid", "inlaid"], rend: ["rent", "rent"],
  shear: ["sheared", "shorn"], slay: ["slew", "slain"], slit: ["slit", "slit"],
  strew: ["strewed", "strewn"], swell: ["swelled", "swollen"], unbind: ["unbound", "unbound"],
  waylay: ["waylaid", "waylaid"],
};

// Regular verbs whose last consonant doubles (regret → regretted). American
// English doesn't double an unstressed l (traveled).
const DOUBLED = new Set(["regret", "deter"]);

function regularPast(verb: string) {
  if (DOUBLED.has(verb)) return `${verb}${verb.at(-1)}ed`;
  if (verb.endsWith("e")) return `${verb}d`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`;
  return `${verb}ed`;
}

// The three forms the page shows after a verb is corrected, so the learner
// sees the past and the participle every time (wear, wore, worn).
export function verbForms(verb: string): [string, string, string] {
  const irregular = IRREGULAR_FORMS[verb];
  if (irregular) return [verb, ...irregular];
  const past = regularPast(verb);
  return [verb, past, past];
}

export function verbsFor(verbType: VerbType, level: Level) {
  return (verbType === "irrégulier" ? IRREGULAR : REGULAR)[level];
}

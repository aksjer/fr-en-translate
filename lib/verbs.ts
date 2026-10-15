import type { Level, VerbType } from "@/lib/options";

// English verbs by type and by the CEFR level learners usually learn them at,
// in American English. The code picks one and the model only translates it:
// asked to choose a verb itself, the model kept writing a sentence instead.
// Verbs that look like their French translation (decide, prefer) are left out.
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
  B1: ["allow", "avoid", "complain", "deliver", "earn", "fail", "hurry", "improve", "notice", "offer", "promise", "share", "suggest", "wonder", "warn", "apologize", "belong", "manage", "rely", "follow"],
  B2: ["achieve", "argue", "attempt", "claim", "encourage", "ignore", "owe", "pretend", "resign", "struggle", "threaten", "urge", "bother", "blame", "cheat", "hesitate", "obey", "regret", "tease", "whisper"],
  C1: ["acknowledge", "convey", "deter", "enhance", "hinder", "jeopardize", "mitigate", "overlook", "postpone", "reassure", "resent", "scrutinize", "undermine", "weigh", "dwindle", "foster", "hamper", "loom", "thrive", "yearn"],
  C2: ["appease", "ascertain", "placate", "relinquish", "reprimand", "belittle", "bolster", "cajole", "dither", "flout", "goad", "rebuke", "scold", "squander", "thwart", "wane", "wheedle", "wield"],
};

export function verbsFor(verbType: VerbType, level: Level) {
  return (verbType === "irrégulier" ? IRREGULAR : REGULAR)[level];
}

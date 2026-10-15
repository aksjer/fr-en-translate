import type { Level, VerbType } from "@/lib/options";

// English verbs by type and by the CEFR level learners usually learn them at,
// in American English, each with its French below. Verbs never go through the
// model: chosen by it, they kept coming out as sentences, and translated by it,
// they came with false friends (pretend → « prétendre ») or with a French verb
// that has another meaning (owe → « devoir », which is also have to).
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
  B1: ["allow", "avoid", "complain", "breathe", "earn", "fail", "hurry", "improve", "notice", "offer", "promise", "share", "suggest", "wonder", "warn", "apologize", "belong", "manage", "rely", "follow"],
  B2: ["swallow", "scratch", "attempt", "claim", "encourage", "shiver", "owe", "rescue", "grumble", "struggle", "threaten", "urge", "bother", "blame", "cheat", "hesitate", "obey", "regret", "tease", "whisper"],
  C1: ["acknowledge", "convey", "deter", "enhance", "hinder", "jeopardize", "mitigate", "overlook", "postpone", "reassure", "dread", "scrutinize", "undermine", "weigh", "dwindle", "foster", "hamper", "loom", "thrive", "yearn"],
  C2: ["appease", "ascertain", "placate", "relinquish", "reprimand", "belittle", "bolster", "cajole", "dither", "flout", "goad", "rebuke", "scold", "squander", "thwart", "wane", "wheedle", "wield"],
};

// The French the learner sees. A context in parentheses picks the meaning
// when the French verb has another common one (« porter » is wear or carry).
const FRENCH: Record<string, string> = {
  // Irregular
  be: "être", have: "avoir", do: "faire (ses devoirs)", go: "aller", come: "venir",
  eat: "manger", drink: "boire", see: "voir", make: "faire (un gâteau)", get: "obtenir",
  give: "donner", take: "prendre", write: "écrire", read: "lire", sleep: "dormir",
  buy: "acheter", sit: "s'asseoir", speak: "parler (une langue)", swim: "nager",
  run: "courir",
  begin: "commencer", bring: "apporter", choose: "choisir", drive: "conduire",
  fall: "tomber", feel: "ressentir", find: "trouver", forget: "oublier",
  hear: "entendre", know: "savoir", leave: "partir", lose: "perdre",
  meet: "rencontrer", pay: "payer", put: "mettre (sur la table)", sell: "vendre",
  send: "envoyer", sing: "chanter", teach: "enseigner", tell: "raconter (une histoire)",
  think: "penser", understand: "comprendre", wear: "porter (un vêtement)",
  win: "gagner (un match)",
  bend: "plier", bite: "mordre", blow: "souffler", break: "casser",
  build: "construire", catch: "attraper", dig: "creuser", draw: "dessiner",
  feed: "nourrir", fight: "se battre", fly: "voler (dans le ciel)", freeze: "geler",
  grow: "grandir", hang: "accrocher (un tableau)", hide: "cacher", hold: "tenir",
  hurt: "blesser", keep: "garder", lend: "prêter", let: "laisser (quelqu'un faire)",
  light: "allumer (une bougie)", ride: "monter (à cheval)", ring: "sonner",
  shake: "secouer", shine: "briller", shoot: "tirer (avec une arme)",
  shut: "fermer (les yeux)", spend: "dépenser", steal: "voler (de l'argent)",
  throw: "lancer (une balle)",
  bet: "parier", bleed: "saigner", burst: "éclater", creep: "se glisser (sans bruit)",
  deal: "distribuer (les cartes)", flee: "fuir", forbid: "interdire",
  forgive: "pardonner", grind: "moudre", kneel: "s'agenouiller",
  lay: "pondre (un œuf)", lead: "mener", mislead: "induire en erreur",
  overcome: "surmonter", seek: "rechercher", shrink: "rétrécir",
  sink: "couler (au fond de l'eau)", slide: "glisser (sur la glace)",
  spin: "tournoyer", spit: "cracher", split: "partager (en deux)",
  spread: "étaler (du beurre)", stick: "coller", sting: "piquer (comme une abeille)",
  strike: "frapper", swear: "jurer", sweep: "balayer", swing: "se balancer",
  tear: "déchirer", weep: "pleurer (doucement)",
  arise: "survenir", bind: "lier", cling: "s'accrocher", dwell: "demeurer (habiter)",
  fling: "jeter (violemment)", foresee: "prévoir", forgo: "renoncer à",
  forsake: "délaisser", outgrow: "devenir trop grand pour",
  overhear: "entendre par hasard", override: "passer outre",
  oversee: "superviser", overtake: "doubler (une voiture)",
  overthrow: "renverser (un gouvernement)", sling: "balancer (négligemment)",
  sow: "semer", stride: "marcher à grands pas", strive: "s'efforcer",
  thrust: "enfoncer (brusquement)", tread: "fouler (le sol)", undergo: "subir",
  undertake: "entreprendre", uphold: "maintenir (une décision)", weave: "tisser",
  withdraw: "retirer (de l'argent)", withhold: "retenir (une information)",
  withstand: "résister à", wring: "tordre (un linge)",
  abide: "supporter (souvent à la négative)", beset: "assaillir",
  forswear: "renoncer à (solennellement)", inlay: "incruster", rend: "déchirer (violemment)",
  shear: "tondre (un mouton)", slay: "tuer (au combat)", slit: "fendre (d'un coup)",
  strew: "éparpiller", swell: "enfler", unbind: "délier", waylay: "intercepter (quelqu'un)",
  // Regular
  work: "travailler", play: "jouer", like: "aimer bien", love: "aimer (quelqu'un)",
  live: "habiter", watch: "regarder (la télévision)", listen: "écouter",
  walk: "marcher", want: "vouloir", cook: "cuisiner", clean: "nettoyer",
  open: "ouvrir", close: "fermer (une boutique)", help: "aider",
  start: "démarrer (une voiture)", call: "appeler", talk: "parler (avec un ami)",
  wash: "laver", stay: "rester",
  ask: "demander", borrow: "emprunter", travel: "voyager", carry: "porter (un sac)",
  enjoy: "apprécier", finish: "finir", hope: "espérer", look: "regarder (une photo)",
  miss: "rater (le bus)", move: "bouger", need: "avoir besoin de",
  remember: "se souvenir de", try: "essayer", wait: "attendre", worry: "s'inquiéter",
  push: "pousser", pull: "tirer (sur une corde)", laugh: "rire", cry: "pleurer",
  learn: "apprendre (une leçon)",
  allow: "permettre", avoid: "éviter", complain: "se plaindre", breathe: "respirer",
  earn: "gagner (de l'argent)", fail: "échouer", hurry: "se dépêcher",
  improve: "améliorer", notice: "remarquer", offer: "offrir", promise: "promettre",
  share: "partager", suggest: "proposer", wonder: "se demander", warn: "avertir",
  apologize: "s'excuser", belong: "appartenir", manage: "gérer (une équipe)",
  rely: "compter sur", follow: "suivre",
  swallow: "avaler", scratch: "gratter", attempt: "tenter",
  claim: "prétendre (affirmer)", encourage: "encourager", shiver: "frissonner",
  owe: "devoir (de l'argent)", rescue: "secourir", grumble: "râler",
  struggle: "lutter", threaten: "menacer", urge: "inciter (vivement)",
  bother: "déranger", blame: "rejeter la faute sur", cheat: "tricher",
  hesitate: "hésiter", obey: "obéir", regret: "regretter", tease: "taquiner",
  whisper: "chuchoter",
  acknowledge: "reconnaître (admettre)", convey: "transmettre", deter: "dissuader",
  enhance: "mettre en valeur", hinder: "entraver", jeopardize: "compromettre",
  mitigate: "atténuer", overlook: "laisser passer (une erreur)", postpone: "reporter",
  reassure: "rassurer", dread: "redouter", scrutinize: "examiner minutieusement",
  undermine: "saper", weigh: "peser", dwindle: "diminuer (peu à peu)",
  foster: "favoriser", hamper: "freiner (un projet)", loom: "se profiler",
  thrive: "prospérer", yearn: "aspirer à",
  appease: "apaiser", ascertain: "s'assurer de", placate: "calmer (quelqu'un)",
  relinquish: "céder (un pouvoir)", reprimand: "réprimander", belittle: "rabaisser",
  bolster: "renforcer", cajole: "amadouer", dither: "tergiverser",
  flout: "bafouer (une règle)", goad: "pousser à bout", rebuke: "faire des reproches à",
  scold: "gronder", squander: "gaspiller", thwart: "déjouer", wane: "décliner",
  wheedle: "enjôler", wield: "manier (une arme)",
};

export function frenchOf(verb: string): string | undefined {
  return FRENCH[verb];
}

// Picks a verb of this type and level, if possible not one of the French
// items given recently, and returns it with its French.
export function pickVerb(verbType: VerbType, level: Level, avoid: string[] = []) {
  const verbs = verbsFor(verbType, level);
  const fresh = verbs.filter((verb) => !avoid.includes(FRENCH[verb]));
  const pool = fresh.length ? fresh : verbs;
  const verb = pool[Math.floor(Math.random() * pool.length)];
  return { verb, french: FRENCH[verb] };
}

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

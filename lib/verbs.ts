import type { Level, VerbType } from "@/lib/options";

// English verbs by type and by the CEFR level learners usually learn them at,
// in American English, each with its French below. Verbs never go through the
// model: chosen by it, they kept coming out as sentences, and translated by it,
// they came with false friends (pretend → « prétendre ») or with a French verb
// that has another meaning (owe → « devoir », which is also have to).
// Verbs that look like their French translation (decide, encourage) are left
// out: they teach nothing.
const IRREGULAR: Record<Level, string[]> = {
  A1: ["be", "have", "do", "go", "come", "eat", "drink", "see", "make", "get", "give", "take", "write", "read", "sleep", "buy", "sit", "speak", "swim", "run", "say", "cut", "stand", "wake"],
  A2: ["begin", "bring", "choose", "drive", "fall", "feel", "find", "forget", "hear", "know", "leave", "lose", "meet", "pay", "put", "sell", "send", "sing", "teach", "tell", "think", "understand", "wear", "win", "mean", "show"],
  B1: ["bend", "bite", "blow", "break", "build", "catch", "dig", "draw", "feed", "fight", "fly", "freeze", "grow", "hang", "hide", "hold", "hurt", "keep", "lend", "let", "light", "ride", "ring", "shake", "shine", "shoot", "shut", "spend", "steal", "throw", "beat", "sew", "quit"],
  B2: ["bet", "bleed", "burst", "creep", "deal", "flee", "forbid", "forgive", "grind", "kneel", "lay", "lead", "mislead", "overcome", "seek", "shrink", "sink", "slide", "spin", "spit", "split", "spread", "stick", "sting", "strike", "swear", "sweep", "swing", "tear", "weep", "lie", "bear", "cast", "leap", "stink", "wind"],
  C1: ["arise", "bind", "cling", "dwell", "fling", "foresee", "forgo", "forsake", "outgrow", "overhear", "override", "oversee", "overtake", "overthrow", "sling", "sow", "stride", "strive", "thrust", "tread", "undergo", "undertake", "uphold", "weave", "withdraw", "withhold", "withstand", "wring"],
  C2: ["abide", "beset", "forswear", "inlay", "rend", "shear", "slay", "slit", "strew", "swell", "unbind", "waylay", "bind", "cling", "forsake", "thrust", "tread", "withstand", "wring"],
};

const REGULAR: Record<Level, string[]> = {
  A1: ["work", "play", "like", "love", "live", "watch", "listen", "walk", "want", "cook", "clean", "open", "close", "help", "start", "call", "talk", "wash", "stay", "jump", "smile", "fill", "paint", "rest", "answer", "count", "rent", "shout", "kiss"],
  A2: ["ask", "borrow", "travel", "carry", "enjoy", "fix", "hope", "look", "miss", "move", "need", "remember", "try", "wait", "worry", "push", "pull", "laugh", "cry", "learn", "bake", "boil", "check", "guess", "hate", "kick", "marry", "taste", "thank", "turn", "cough"],
  B1: ["allow", "avoid", "complain", "breathe", "earn", "fail", "hurry", "improve", "notice", "pour", "lift", "share", "knock", "wonder", "warn", "apologize", "belong", "manage", "rely", "follow", "bury", "chase", "deny", "fetch", "greet", "hire", "remind", "rush", "save", "sneeze", "stretch", "lock", "spill", "wipe"],
  B2: ["swallow", "scratch", "attempt", "claim", "sigh", "shiver", "owe", "rescue", "grumble", "struggle", "threaten", "urge", "bother", "blame", "cheat", "stumble", "frown", "stare", "tease", "whisper", "bargain", "beg", "brag", "chew", "cuddle", "drown", "gasp", "hug", "nod", "scream", "squeeze", "sulk", "sweat", "wander", "yawn", "blush"],
  C1: ["acknowledge", "convey", "deter", "enhance", "hinder", "jeopardize", "mitigate", "overlook", "postpone", "dismiss", "dread", "scrutinize", "undermine", "weigh", "dwindle", "foster", "hamper", "loom", "thrive", "yearn", "bewilder", "deem", "endorse", "entice", "flinch", "grasp", "hoard", "outweigh", "relish", "stifle", "unveil", "tamper"],
  C2: ["fathom", "ascertain", "placate", "relinquish", "loathe", "belittle", "bolster", "cajole", "dither", "flout", "goad", "rebuke", "scold", "squander", "thwart", "wane", "wheedle", "wield", "bemoan", "cower", "dawdle", "embezzle", "fester", "gloat", "hobble", "jostle", "loiter", "quell", "rummage", "scoff", "wallow", "whimper"],
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
  say: "dire",
  cut: "couper",
  stand: "être debout",
  wake: "se réveiller",
  mean: "vouloir dire",
  show: "montrer",
  beat: "battre",
  sew: "coudre",
  quit: "arrêter (de fumer)",
  lie: "s'allonger",
  bear: "supporter (une douleur)",
  cast: "jeter (un sort)",
  leap: "bondir",
  stink: "puer",
  wind: "remonter (une montre)",
  // Regular
  work: "travailler", play: "jouer", like: "aimer bien", love: "aimer (quelqu'un)",
  live: "habiter", watch: "regarder (la télévision)", listen: "écouter",
  walk: "marcher", want: "vouloir", cook: "cuisiner", clean: "nettoyer",
  open: "ouvrir", close: "fermer (une boutique)", help: "aider",
  start: "démarrer (une voiture)", call: "appeler", talk: "parler (avec un ami)",
  wash: "laver", stay: "rester",
  ask: "demander", borrow: "emprunter", travel: "voyager", carry: "porter (un sac)",
  enjoy: "apprécier", fix: "réparer", hope: "espérer", look: "regarder (une photo)",
  miss: "rater (le bus)", move: "bouger", need: "avoir besoin de",
  remember: "se souvenir de", try: "essayer", wait: "attendre", worry: "s'inquiéter",
  push: "pousser", pull: "tirer (sur une corde)", laugh: "rire", cry: "pleurer",
  learn: "apprendre (une leçon)",
  allow: "permettre", avoid: "éviter", complain: "se plaindre", breathe: "respirer",
  earn: "gagner (de l'argent)", fail: "échouer", hurry: "se dépêcher",
  improve: "améliorer", notice: "remarquer", pour: "verser (de l'eau)", lift: "soulever",
  share: "partager", knock: "frapper (à la porte)", wonder: "se demander", warn: "avertir",
  apologize: "s'excuser", belong: "appartenir", manage: "gérer (une équipe)",
  rely: "compter sur", follow: "suivre",
  swallow: "avaler", scratch: "gratter", attempt: "tenter",
  claim: "prétendre (affirmer)", sigh: "soupirer", shiver: "frissonner",
  owe: "devoir (de l'argent)", rescue: "secourir", grumble: "râler",
  struggle: "lutter", threaten: "menacer", urge: "inciter (vivement)",
  bother: "déranger", blame: "rejeter la faute sur", cheat: "tricher",
  stumble: "trébucher", frown: "froncer les sourcils", stare: "fixer (du regard)", tease: "taquiner",
  whisper: "chuchoter",
  acknowledge: "reconnaître (admettre)", convey: "transmettre", deter: "dissuader",
  enhance: "mettre en valeur", hinder: "entraver", jeopardize: "compromettre",
  mitigate: "atténuer", overlook: "laisser passer (une erreur)", postpone: "reporter",
  dismiss: "écarter (une idée)", dread: "redouter", scrutinize: "examiner minutieusement",
  undermine: "saper", weigh: "peser", dwindle: "diminuer (peu à peu)",
  foster: "favoriser", hamper: "freiner (un projet)", loom: "se profiler",
  thrive: "prospérer", yearn: "aspirer à",
  fathom: "comprendre (en profondeur)", ascertain: "s'assurer de", placate: "calmer (quelqu'un)",
  relinquish: "céder (un pouvoir)", loathe: "détester (profondément)", belittle: "rabaisser",
  bolster: "renforcer", cajole: "amadouer", dither: "tergiverser",
  flout: "bafouer (une règle)", goad: "pousser à bout", rebuke: "faire des reproches à",
  scold: "gronder", squander: "gaspiller", thwart: "déjouer", wane: "décliner",
  wheedle: "enjôler", wield: "manier (une arme)",
  jump: "sauter",
  smile: "sourire",
  fill: "remplir",
  paint: "peindre",
  rest: "se reposer",
  answer: "répondre",
  count: "compter",
  rent: "louer (un appartement)",
  shout: "crier",
  kiss: "embrasser (sur la joue)",
  bake: "faire cuire (au four)",
  boil: "faire bouillir",
  check: "vérifier",
  guess: "deviner",
  hate: "détester",
  kick: "donner un coup de pied",
  marry: "épouser",
  taste: "goûter",
  thank: "remercier",
  turn: "tourner",
  cough: "tousser",
  bury: "enterrer",
  chase: "courir après",
  deny: "nier",
  fetch: "aller chercher",
  greet: "saluer",
  hire: "embaucher",
  remind: "rappeler (quelque chose à quelqu'un)",
  rush: "se précipiter",
  save: "économiser (de l'argent)",
  sneeze: "éternuer",
  stretch: "s'étirer",
  lock: "fermer à clé",
  spill: "renverser (un liquide)",
  wipe: "essuyer",
  bargain: "marchander",
  beg: "supplier",
  brag: "se vanter",
  chew: "mâcher",
  cuddle: "faire un câlin",
  drown: "se noyer",
  gasp: "avoir le souffle coupé",
  hug: "serrer dans ses bras",
  nod: "faire oui de la tête",
  scream: "hurler",
  squeeze: "presser (un citron)",
  sulk: "bouder",
  sweat: "transpirer",
  wander: "errer",
  yawn: "bâiller",
  blush: "rougir",
  bewilder: "déconcerter",
  deem: "juger (considérer comme)",
  endorse: "appuyer (une candidature)",
  entice: "allécher",
  flinch: "tressaillir",
  grasp: "saisir (une idée)",
  hoard: "amasser (des provisions)",
  outweigh: "l'emporter sur",
  relish: "savourer",
  stifle: "étouffer",
  unveil: "dévoiler",
  tamper: "trafiquer (un compteur)",
  bemoan: "se lamenter sur",
  cower: "se recroqueviller (de peur)",
  dawdle: "traînasser",
  embezzle: "détourner (des fonds)",
  fester: "s'envenimer",
  gloat: "jubiler (méchamment)",
  hobble: "boitiller",
  jostle: "bousculer",
  loiter: "traîner (dans la rue)",
  quell: "réprimer (une révolte)",
  rummage: "fouiller",
  scoff: "se moquer de",
  wallow: "se vautrer",
  whimper: "gémir",
};

export function frenchOf(verb: string): string | undefined {
  return FRENCH[verb];
}

// Picks a verb of this type and level, and returns it with its French:
// never one the learner already got right (known) while others are left, and
// if possible not one given recently (avoid, oldest first). A verb due for
// review (its French) comes back as is.
export function pickVerb(
  verbType: VerbType,
  level: Level,
  avoid: string[] = [],
  known: string[] = [],
  review?: string,
) {
  const reviewed = Object.keys(FRENCH).find((verb) => FRENCH[verb] === review);
  if (reviewed) return { verb: reviewed, french: FRENCH[reviewed] };
  const verbs = verbsFor(verbType, level);
  const unknown = verbs.filter((verb) => !known.includes(FRENCH[verb]));
  // Every verb of this level is known: they come back, the oldest first.
  const pool = unknown.length ? unknown : verbs;
  const fresh = pool.filter((verb) => !avoid.includes(FRENCH[verb]));
  const verb = fresh.length
    ? fresh[Math.floor(Math.random() * fresh.length)]
    : pool.reduce((oldest, verb) =>
        avoid.lastIndexOf(FRENCH[verb]) < avoid.lastIndexOf(FRENCH[oldest]) ? verb : oldest,
      );
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
  say: ["said", "said"],
  cut: ["cut", "cut"],
  stand: ["stood", "stood"],
  wake: ["woke", "woken"],
  mean: ["meant", "meant"],
  show: ["showed", "shown"],
  beat: ["beat", "beaten"],
  sew: ["sewed", "sewn"],
  quit: ["quit", "quit"],
  lie: ["lay", "lain"],
  bear: ["bore", "borne"],
  cast: ["cast", "cast"],
  leap: ["leaped/leapt", "leaped/leapt"],
  stink: ["stank", "stunk"],
  wind: ["wound", "wound"],
};

// Regular verbs whose last consonant doubles (deter → deterred). American
// English doesn't double an unstressed l (traveled).
const DOUBLED = new Set(["deter", "beg", "brag", "hug", "nod"]);

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

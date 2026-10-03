/**
 * Built-in content for the English track of Learn Skills: vocabulary,
 * grammar mini-lessons, writing prompts, speaking sentences and the
 * common-confusion list used by the offline writing checker.
 */

export type EnglishLevel = "beginner" | "intermediate" | "advanced"

export const ENGLISH_LEVELS: { value: EnglishLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
]

export const LEVEL_LABEL: Record<EnglishLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

/* ------------------------------------------------------------ vocabulary */

export interface VocabWord {
  /** Stable id, also used as the spaced-repetition card id. */
  id: string
  word: string
  pos: string
  meaning: string
  example: string
  level: EnglishLevel
  /** Optional Hindi hint. */
  hi?: string
}

type Row = [word: string, pos: string, meaning: string, example: string, hi?: string]

const BEGINNER: Row[] = [
  ["borrow", "verb", "to take something and promise to give it back", "Can I borrow your pen for a minute?", "उधार लेना"],
  ["lend", "verb", "to give something to someone for a short time", "She lent me her umbrella when it rained.", "उधार देना"],
  ["arrive", "verb", "to reach a place", "Our train will arrive at 6 pm.", "पहुँचना"],
  ["busy", "adjective", "having a lot of things to do", "I'm busy today, but free tomorrow.", "व्यस्त"],
  ["cheap", "adjective", "costing little money", "The vegetables at this market are cheap.", "सस्ता"],
  ["expensive", "adjective", "costing a lot of money", "That phone is too expensive for me.", "महंगा"],
  ["early", "adverb", "before the usual or expected time", "I woke up early to go for a walk.", "जल्दी"],
  ["late", "adjective", "after the expected time", "Sorry I'm late — the bus didn't come.", "देर"],
  ["remember", "verb", "to keep something in your mind", "Do you remember her phone number?", "याद रखना"],
  ["forget", "verb", "to not remember something", "Don't forget to bring your ID card.", "भूलना"],
  ["choose", "verb", "to pick one thing from many", "You can choose any seat you like.", "चुनना"],
  ["decide", "verb", "to make a choice after thinking", "We decided to stay at home.", "तय करना"],
  ["explain", "verb", "to make something clear and easy to understand", "Can you explain this rule again?", "समझाना"],
  ["improve", "verb", "to make or become better", "Reading every day will improve your English.", "सुधारना"],
  ["healthy", "adjective", "good for your body; not ill", "Fruit is a healthy snack.", "स्वस्थ"],
  ["tired", "adjective", "needing rest or sleep", "I'm tired after the long journey.", "थका हुआ"],
  ["hungry", "adjective", "wanting to eat", "The kids are hungry — let's have lunch.", "भूखा"],
  ["quiet", "adjective", "making little or no noise", "The library is a quiet place to study.", "शांत"],
  ["noisy", "adjective", "making a lot of noise", "The street outside is very noisy at night.", "शोरगुल वाला"],
  ["neighbour", "noun", "a person who lives near you", "Our neighbour gave us sweets for Diwali.", "पड़ोसी"],
  ["journey", "noun", "travelling from one place to another", "The journey to Goa took ten hours.", "यात्रा"],
  ["weather", "noun", "how hot, cold, rainy or sunny it is", "The weather is lovely today.", "मौसम"],
  ["appointment", "noun", "a fixed time to meet someone", "I have a doctor's appointment at 4.", "मुलाक़ात का समय"],
  ["invite", "verb", "to ask someone to come to an event", "They invited us to their wedding.", "आमंत्रित करना"],
  ["return", "verb", "to come or go back; to give back", "Please return the book by Friday.", "लौटना / लौटाना"],
  ["repair", "verb", "to fix something that is broken", "He repaired my bicycle in ten minutes.", "मरम्मत करना"],
  ["clean", "verb", "to remove dirt from something", "We clean the house every Sunday.", "साफ़ करना"],
  ["careful", "adjective", "thinking about what you do so nothing goes wrong", "Be careful — the floor is wet.", "सावधान"],
  ["polite", "adjective", "speaking and behaving kindly and with respect", "It's polite to say thank you.", "विनम्र"],
  ["angry", "adjective", "feeling strong annoyance", "He was angry when his phone broke.", "गुस्सा"],
  ["afraid", "adjective", "feeling fear", "My little sister is afraid of dogs.", "डरा हुआ"],
  ["enough", "determiner", "as much as you need", "Do we have enough milk for tea?", "पर्याप्त"],
  ["often", "adverb", "many times; frequently", "I often call my parents in the evening.", "अक्सर"],
  ["usually", "adverb", "in most cases; normally", "I usually take the metro to work.", "आमतौर पर"],
  ["never", "adverb", "not at any time", "She never eats meat.", "कभी नहीं"],
  ["already", "adverb", "before now or before expected", "I've already finished my homework.", "पहले ही"],
  ["still", "adverb", "continuing until now", "Are you still at the office?", "अभी भी"],
  ["maybe", "adverb", "perhaps; it is possible", "Maybe we can meet next week.", "शायद"],
  ["outside", "adverb", "not in a building", "Let's sit outside — it's sunny.", "बाहर"],
  ["near", "preposition", "a short distance from", "Is there an ATM near here?", "पास"],
  ["between", "preposition", "in the space that separates two things", "The bank is between the school and the park.", "बीच में"],
  ["prepare", "verb", "to make ready", "I need to prepare for tomorrow's test.", "तैयार करना"],
  ["practise", "verb", "to do something again and again to get better", "Practise speaking English every day.", "अभ्यास करना"],
  ["share", "verb", "to give part of something to others; to use together", "Let's share this pizza.", "बाँटना"],
  ["understand", "verb", "to know the meaning of something", "I don't understand this word.", "समझना"],
]

const INTERMEDIATE: Row[] = [
  ["achieve", "verb", "to succeed in doing something after effort", "She achieved her goal of running 5 km.", "हासिल करना"],
  ["available", "adjective", "free to use or to meet", "Is the manager available this afternoon?", "उपलब्ध"],
  ["convenient", "adjective", "easy and suitable for your plans", "Is 3 pm a convenient time for the call?", "सुविधाजनक"],
  ["deadline", "noun", "the latest time by which something must be done", "The deadline for the report is Monday.", "अंतिम तिथि"],
  ["confirm", "verb", "to say that something is true or definite", "Please confirm your booking by email.", "पुष्टि करना"],
  ["postpone", "verb", "to move an event to a later time", "The meeting has been postponed until Friday.", "स्थगित करना"],
  ["schedule", "noun", "a plan of times when things will happen", "My schedule is full this week.", "समय-सारणी"],
  ["reliable", "adjective", "can be trusted to do what is expected", "He's a reliable colleague who never misses a deadline.", "भरोसेमंद"],
  ["responsible", "adjective", "having the duty to take care of something", "Who is responsible for the budget?", "ज़िम्मेदार"],
  ["opportunity", "noun", "a chance to do something good", "This job is a great opportunity to learn.", "अवसर"],
  ["experience", "noun", "knowledge or skill from doing something", "Do you have any experience in sales?", "अनुभव"],
  ["suggest", "verb", "to offer an idea for others to consider", "I suggest we leave early to avoid traffic.", "सुझाव देना"],
  ["recommend", "verb", "to say that something is good and worth trying", "Can you recommend a good book?", "सिफ़ारिश करना"],
  ["mention", "verb", "to speak about something briefly", "She mentioned that she was moving to Pune.", "ज़िक्र करना"],
  ["admit", "verb", "to agree that something (often bad) is true", "He admitted that he made a mistake.", "स्वीकार करना"],
  ["avoid", "verb", "to keep away from something", "Try to avoid sugary drinks.", "बचना"],
  ["complain", "verb", "to say you are unhappy about something", "Customers complained about the slow service.", "शिकायत करना"],
  ["efficient", "adjective", "working well without wasting time or energy", "This new process is more efficient.", "कुशल"],
  ["effective", "adjective", "producing the result you want", "Exercise is an effective way to reduce stress.", "प्रभावी"],
  ["essential", "adjective", "absolutely necessary", "Water is essential for life.", "आवश्यक"],
  ["familiar", "adjective", "known to you; easy to recognise", "Her face looks familiar.", "परिचित"],
  ["obvious", "adjective", "easy to see or understand", "The answer was obvious once I saw it.", "स्पष्ट"],
  ["particular", "adjective", "a specific one, not general", "Is there a particular day that suits you?", "विशेष"],
  ["previous", "adjective", "happening before this one", "In my previous job, I worked in Chennai.", "पिछला"],
  ["regular", "adjective", "happening often or at fixed times", "Regular exercise keeps you fit.", "नियमित"],
  ["temporary", "adjective", "lasting for a short time only", "This is a temporary solution until the repair.", "अस्थायी"],
  ["permanent", "adjective", "lasting for a long time or forever", "She's looking for a permanent job.", "स्थायी"],
  ["require", "verb", "to need", "This form requires your signature.", "आवश्यकता होना"],
  ["provide", "verb", "to give something that is needed", "The hotel provides free breakfast.", "प्रदान करना"],
  ["manage", "verb", "to succeed in doing something difficult; to be in charge", "I managed to finish on time.", "संभालना"],
  ["negotiate", "verb", "to discuss to reach an agreement", "We negotiated a better price.", "मोल-भाव करना"],
  ["patient", "adjective", "able to wait calmly", "Please be patient — the doctor will see you soon.", "धैर्यवान"],
  ["confident", "adjective", "sure of your own abilities", "She felt confident before the interview.", "आत्मविश्वासी"],
  ["anxious", "adjective", "worried and nervous", "I always feel anxious before exams.", "चिंतित"],
  ["grateful", "adjective", "feeling thankful", "I'm grateful for your help.", "आभारी"],
  ["upset", "adjective", "unhappy or worried because of something", "He was upset about the bad news.", "परेशान"],
  ["afford", "verb", "to have enough money for something", "We can't afford a new car this year.", "ख़र्च उठा पाना"],
  ["budget", "noun", "a plan for how to spend money", "Let's stay within our budget.", "बजट"],
  ["refund", "noun", "money given back to you", "I asked for a refund for the broken headphones.", "धन-वापसी"],
  ["feedback", "noun", "comments about how well someone did something", "Thanks for the useful feedback on my report.", "प्रतिक्रिया"],
  ["attend", "verb", "to go to an event", "Over 200 people attended the conference.", "उपस्थित होना"],
  ["apologise", "verb", "to say sorry", "I apologise for the delay.", "माफ़ी माँगना"],
  ["request", "noun", "a polite act of asking for something", "We received your request for leave.", "अनुरोध"],
  ["eventually", "adverb", "in the end, after a long time", "Eventually, we found the right address.", "आख़िरकार"],
  ["instead", "adverb", "in place of something else", "Let's walk instead of taking a taxi.", "के बजाय"],
  ["probably", "adverb", "very likely", "It will probably rain tonight.", "शायद / संभवतः"],
]

const ADVANCED: Row[] = [
  ["ambiguous", "adjective", "having more than one possible meaning", "The instructions were ambiguous, so we asked again.", "अस्पष्ट"],
  ["meticulous", "adjective", "very careful about every small detail", "She is meticulous about checking her work.", "बारीकी से ध्यान देने वाला"],
  ["pragmatic", "adjective", "dealing with things in a practical way", "We need a pragmatic solution, not a perfect one.", "व्यावहारिक"],
  ["concise", "adjective", "short and clear, without extra words", "Keep your email concise.", "संक्षिप्त"],
  ["comprehensive", "adjective", "including everything that is needed", "The guide gives a comprehensive overview.", "व्यापक"],
  ["feasible", "adjective", "possible and practical to do", "Is it feasible to finish by Friday?", "संभव"],
  ["inevitable", "adjective", "certain to happen; impossible to avoid", "Some mistakes are inevitable when learning.", "अनिवार्य"],
  ["resilient", "adjective", "able to recover quickly from problems", "Children are often very resilient.", "लचीला"],
  ["diligent", "adjective", "working hard and carefully", "A diligent student revises regularly.", "मेहनती"],
  ["candid", "adjective", "honest and direct", "Thank you for your candid feedback.", "स्पष्टवादी"],
  ["reluctant", "adjective", "not willing to do something", "He was reluctant to share his salary.", "अनिच्छुक"],
  ["substantial", "adjective", "large in amount or importance", "There was a substantial increase in sales.", "काफ़ी"],
  ["plausible", "adjective", "seeming reasonable or likely to be true", "Her excuse sounded plausible.", "विश्वसनीय लगने वाला"],
  ["scrutinise", "verb", "to examine something very carefully", "The auditors scrutinised every invoice.", "बारीकी से जाँचना"],
  ["mitigate", "verb", "to make something bad less serious", "Backups mitigate the risk of losing data.", "कम करना"],
  ["undermine", "verb", "to gradually weaken something", "Constant criticism can undermine confidence.", "कमज़ोर करना"],
  ["advocate", "verb", "to publicly support an idea", "She advocates for flexible working hours.", "समर्थन करना"],
  ["alleviate", "verb", "to make pain or a problem less severe", "This medicine will alleviate the pain.", "राहत देना"],
  ["anticipate", "verb", "to expect something and prepare for it", "We anticipate heavy traffic during the festival.", "पूर्वानुमान लगाना"],
  ["articulate", "verb", "to express ideas clearly in words", "He articulated his concerns very well.", "स्पष्ट रूप से व्यक्त करना"],
  ["collaborate", "verb", "to work together with others", "Our teams collaborate on every launch.", "सहयोग करना"],
  ["deteriorate", "verb", "to become worse", "His health deteriorated during the winter.", "बिगड़ना"],
  ["elaborate", "verb", "to give more details", "Could you elaborate on your second point?", "विस्तार से बताना"],
  ["facilitate", "verb", "to make a process easier", "Good tools facilitate remote work.", "सुगम बनाना"],
  ["implement", "verb", "to put a plan or decision into action", "We will implement the new policy in May.", "लागू करना"],
  ["prioritise", "verb", "to decide what is most important and do it first", "Prioritise the tasks with the nearest deadlines.", "प्राथमिकता देना"],
  ["discrepancy", "noun", "a difference between things that should match", "There's a discrepancy between the two reports.", "विसंगति"],
  ["consensus", "noun", "general agreement among a group", "The team reached a consensus after a long discussion.", "सर्वसम्मति"],
  ["incentive", "noun", "something that encourages you to do something", "Bonuses are an incentive to work harder.", "प्रोत्साहन"],
  ["setback", "noun", "a problem that delays progress", "The injury was a temporary setback.", "रुकावट"],
  ["leverage", "verb", "to use something to maximum advantage", "We can leverage our existing customers to grow.", "लाभ उठाना"],
  ["nuance", "noun", "a very small difference in meaning or feeling", "Translation often loses the nuance of the original.", "बारीक अंतर"],
  ["redundant", "adjective", "not needed because it repeats something", "Remove redundant words like \"revert back\".", "अनावश्यक"],
  ["tentative", "adjective", "not certain or fixed; still a suggestion", "We have a tentative date for the launch.", "अस्थायी / अनिश्चित"],
  ["unprecedented", "adjective", "never having happened before", "The city saw unprecedented rainfall this year.", "अभूतपूर्व"],
  ["versatile", "adjective", "able to do many different things", "Rice is a versatile ingredient.", "बहुमुखी"],
  ["coherent", "adjective", "logical and clearly connected", "Make sure your essay is coherent.", "सुसंगत"],
  ["compelling", "adjective", "very interesting or convincing", "She made a compelling argument for change.", "प्रभावशाली"],
  ["notwithstanding", "preposition", "in spite of", "Notwithstanding the delays, the project succeeded.", "के बावजूद"],
  ["albeit", "conjunction", "although (used before a short phrase)", "It was a good result, albeit a little late.", "हालाँकि"],
]

function slug(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

function build(rows: Row[], level: EnglishLevel): VocabWord[] {
  return rows.map(([word, pos, meaning, example, hi]) => ({ id: `en-vocab:${slug(word)}`, word, pos, meaning, example, level, hi }))
}

export const VOCABULARY: VocabWord[] = [...build(BEGINNER, "beginner"), ...build(INTERMEDIATE, "intermediate"), ...build(ADVANCED, "advanced")]

/** Deterministic "word of the day" for a yyyy-MM-dd string. */
export function wordOfTheDay(date: string): VocabWord {
  let h = 0
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return VOCABULARY[h % VOCABULARY.length]
}

/* --------------------------------------------------------------- grammar */

export type QuizQuestion =
  | { kind: "mcq"; question: string; options: string[]; answerIndex: number; explanation: string }
  | { kind: "blank"; question: string; answers: string[]; explanation: string }

export interface GrammarLesson {
  id: string
  title: string
  level: EnglishLevel
  summary: string
  rules: string[]
  examples: { right: string; wrong?: string; note?: string }[]
  quiz: QuizQuestion[]
}

const mcq = (question: string, options: string[], answerIndex: number, explanation: string): QuizQuestion => ({
  kind: "mcq",
  question,
  options,
  answerIndex,
  explanation,
})
const blank = (question: string, answers: string[], explanation: string): QuizQuestion => ({ kind: "blank", question, answers, explanation })

export const GRAMMAR_LESSONS: GrammarLesson[] = [
  {
    id: "articles",
    title: "Articles: a, an, the",
    level: "beginner",
    summary: "When to use a, an, the — or no article at all.",
    rules: [
      "Use \"a\" before a consonant sound and \"an\" before a vowel sound: a car, an apple, an hour, a university.",
      "Use \"a/an\" for one thing that is new or not specific: I saw a dog.",
      "Use \"the\" when both people know which thing you mean, or it's the only one: the dog I told you about, the sun.",
      "Use no article for general plural or uncountable nouns: Dogs are friendly. Water is important.",
    ],
    examples: [
      { right: "She is an engineer.", wrong: "She is engineer.", note: "Jobs need a/an." },
      { right: "It took an hour.", wrong: "It took a hour.", note: "\"Hour\" starts with a vowel sound." },
      { right: "Can you close the door?", note: "We both know which door." },
      { right: "I love music.", wrong: "I love the music.", note: "Music in general — no article." },
    ],
    quiz: [
      mcq("I waited for ___ hour.", ["a", "an", "the", "(no article)"], 1, "\"Hour\" begins with a vowel sound (the h is silent), so we use \"an\"."),
      mcq("She wants to study at ___ university in Delhi.", ["a", "an", "the", "(no article)"], 0, "\"University\" begins with a \"yoo\" (consonant) sound, so we use \"a\"."),
      mcq("___ moon looks beautiful tonight.", ["A", "An", "The", "(no article)"], 2, "There is only one moon, so we use \"the\"."),
      blank("My brother is ___ doctor.", ["a"], "Jobs take a/an; \"doctor\" starts with a consonant sound."),
      mcq("___ honesty is the best policy.", ["A", "An", "The", "(no article)"], 3, "Honesty is an abstract, uncountable idea in general — no article."),
    ],
  },
  {
    id: "tenses",
    title: "Present simple vs present continuous",
    level: "beginner",
    summary: "Habits and facts vs things happening right now.",
    rules: [
      "Present simple for habits, routines and facts: I go to the gym every day. Water boils at 100°C.",
      "Present continuous (am/is/are + -ing) for actions happening now or around now: I'm working from home this week.",
      "Some \"state\" verbs are rarely used in the continuous: know, like, want, need, believe, understand.",
      "Signal words: always, usually, every day → simple; now, at the moment, currently → continuous.",
    ],
    examples: [
      { right: "I understand the problem.", wrong: "I am understanding the problem.", note: "\"Understand\" is a state verb." },
      { right: "She usually walks to work.", note: "Routine → present simple." },
      { right: "Look! It's raining.", note: "Happening now → continuous." },
      { right: "He lives in Mumbai.", wrong: "He is living in Mumbai since 2010.", note: "For \"since\", use present perfect: has lived." },
    ],
    quiz: [
      mcq("Listen! Someone ___ at the door.", ["knocks", "is knocking", "knock", "knocked"], 1, "\"Listen!\" shows it's happening now → present continuous."),
      mcq("I ___ coffee every morning.", ["am drinking", "drinks", "drink", "drinking"], 2, "A daily habit → present simple; with \"I\" the verb has no -s."),
      mcq("We ___ the answer.", ["know", "are knowing", "knows", "is knowing"], 0, "\"Know\" is a state verb, so we use present simple."),
      blank("She ___ (work) late this week because of a deadline.", ["is working", "'s working"], "A temporary situation around now → present continuous."),
      mcq("The shop ___ at 9 am every day.", ["is opening", "open", "opens", "opening"], 2, "A schedule/routine with a singular subject → \"opens\"."),
    ],
  },
  {
    id: "prepositions",
    title: "Prepositions of time and place: in, on, at",
    level: "beginner",
    summary: "From big to small: in → on → at.",
    rules: [
      "Time — in: months, years, seasons, parts of the day (in May, in 2025, in the morning).",
      "Time — on: days and dates (on Monday, on 15 August, on my birthday).",
      "Time — at: clock times and short points (at 5 pm, at night, at the weekend in British English).",
      "Place — in: inside an area (in the room, in India); on: a surface or street (on the table, on MG Road); at: a point or address (at the station, at 12 Park Street).",
    ],
    examples: [
      { right: "The meeting is on Monday at 10 am.", wrong: "The meeting is in Monday at 10 am." },
      { right: "I was born in 1998.", wrong: "I was born on 1998." },
      { right: "She's waiting at the bus stop.", note: "A specific point → at." },
      { right: "The keys are on the table.", note: "A surface → on." },
    ],
    quiz: [
      mcq("My birthday is ___ June.", ["in", "on", "at", "by"], 0, "Months take \"in\"."),
      mcq("Let's meet ___ 7 o'clock.", ["in", "on", "at", "for"], 2, "Clock times take \"at\"."),
      mcq("The picture is ___ the wall.", ["in", "on", "at", "to"], 1, "A surface takes \"on\"."),
      blank("We have a holiday ___ 26 January.", ["on"], "Dates take \"on\"."),
      mcq("I'll see you ___ the airport.", ["in", "on", "at", "into"], 2, "A specific meeting point takes \"at\"."),
    ],
  },
  {
    id: "agreement",
    title: "Subject–verb agreement",
    level: "intermediate",
    summary: "Singular subjects take singular verbs — even when it's tricky.",
    rules: [
      "Singular subject → singular verb (he works); plural subject → plural verb (they work).",
      "Ignore words between the subject and the verb: The box of chocolates is on the table.",
      "Each, every, everyone, nobody, someone take a singular verb: Everyone is here.",
      "With \"either/neither … or/nor\", the verb agrees with the nearer subject: Neither the manager nor the employees were told.",
    ],
    examples: [
      { right: "The list of tasks is long.", wrong: "The list of tasks are long.", note: "The subject is \"list\"." },
      { right: "Each of the students has a laptop.", wrong: "Each of the students have a laptop." },
      { right: "My friends and I are going out.", note: "Two subjects joined by \"and\" → plural." },
      { right: "The news is good.", wrong: "The news are good.", note: "\"News\" is uncountable." },
    ],
    quiz: [
      mcq("The quality of these products ___ excellent.", ["are", "is", "were", "be"], 1, "The subject is \"quality\" (singular)."),
      mcq("Everyone in the office ___ the new rules.", ["know", "are knowing", "knows", "have known"], 2, "\"Everyone\" is singular."),
      mcq("Neither my sister nor my parents ___ coming.", ["is", "are", "was", "has"], 1, "The verb agrees with the nearer subject, \"parents\" (plural)."),
      blank("Rahul and Priya ___ (be) married.", ["are"], "Two subjects joined by \"and\" take a plural verb."),
      mcq("Mathematics ___ my favourite subject.", ["are", "were", "is", "have been"], 2, "Subjects like mathematics, physics, news are singular."),
    ],
  },
  {
    id: "countable",
    title: "Countable and uncountable nouns",
    level: "intermediate",
    summary: "Many vs much, few vs little — and words that never take -s.",
    rules: [
      "Countable nouns have plurals: one chair, two chairs. Use many / few / a number of.",
      "Uncountable nouns have no plural: information, advice, furniture, luggage, equipment, news, money. Use much / little / an amount of.",
      "Use \"a piece of\" to count uncountables: a piece of advice, two pieces of furniture.",
      "\"Some\" and \"a lot of\" work with both.",
    ],
    examples: [
      { right: "Can you give me some advice?", wrong: "Can you give me some advices?" },
      { right: "We have a lot of luggage.", wrong: "We have many luggages." },
      { right: "There isn't much time left.", note: "Time (uncountable) → much." },
      { right: "Only a few people came.", note: "People (countable) → few." },
    ],
    quiz: [
      mcq("How ___ information do you need?", ["many", "much", "few", "a few"], 1, "\"Information\" is uncountable → much."),
      mcq("She gave me two ___.", ["advices", "advice", "pieces of advice", "piece of advices"], 2, "Advice is uncountable; count it with \"pieces of\"."),
      mcq("There are too ___ cars on the road.", ["much", "little", "many", "less"], 2, "Cars are countable → many."),
      blank("We bought new ___ (furniture) for the flat.", ["furniture"], "\"Furniture\" is uncountable — it never takes -s."),
      mcq("I have very ___ money left this month.", ["few", "little", "many", "a few"], 1, "Money is uncountable → little."),
    ],
  },
  {
    id: "modals",
    title: "Modal verbs: can, could, should, must, might",
    level: "intermediate",
    summary: "Ability, permission, advice, obligation and possibility.",
    rules: [
      "Modal + base verb, no \"to\" and no -s: She can swim (not \"can to swim\" or \"cans swim\").",
      "can / could = ability or permission (could is more polite): Could you help me?",
      "should = advice: You should rest. must = strong obligation: You must wear a helmet.",
      "might / may = possibility: It might rain later. \"Mustn't\" = not allowed; \"don't have to\" = not necessary.",
    ],
    examples: [
      { right: "You should see a doctor.", wrong: "You should to see a doctor." },
      { right: "Could you send me the file?", note: "Polite request." },
      { right: "You don't have to come if you're busy.", note: "Not necessary." },
      { right: "You mustn't smoke here.", note: "Not allowed." },
    ],
    quiz: [
      mcq("You look tired. You ___ go to bed early.", ["must to", "should", "can to", "might to"], 1, "Advice → should + base verb."),
      mcq("___ you pass me the salt, please?", ["Must", "Should", "Could", "Might"], 2, "Polite request → could."),
      mcq("Take an umbrella — it ___ rain later.", ["might", "must", "should to", "can to"], 0, "Possibility → might."),
      mcq("It's a holiday tomorrow, so we ___ go to the office.", ["mustn't", "don't have to", "can't to", "shouldn't to"], 1, "Not necessary → don't have to."),
      blank("She ___ (can) speak three languages.", ["can"], "Modals never take -s: she can, not she cans."),
    ],
  },
  {
    id: "indian-english",
    title: "Common Indian-English corrections",
    level: "intermediate",
    summary: "Phrases that sound natural locally but are marked as errors internationally.",
    rules: [
      "\"Discuss\" takes a direct object: discuss the plan (not \"discuss about the plan\").",
      "\"Revert\" means reply or return to a previous state — \"back\" is redundant: Please revert by Friday / I'll get back to you.",
      "Avoid doubling: return (not \"return back\"), repeat (not \"repeat again\"), cope with (not \"cope up with\").",
      "\"Do the needful\" and \"prepone\" are understood in India but unclear elsewhere: say \"please take care of this\" / \"bring forward\".",
      "Use \"since\" with a starting point and \"for\" with a length of time, with present perfect: I have lived here since 2015 / for ten years.",
    ],
    examples: [
      { right: "Let's discuss the budget.", wrong: "Let's discuss about the budget." },
      { right: "I'll get back to you tomorrow.", wrong: "I'll revert back to you tomorrow." },
      { right: "Can we bring the meeting forward to 10?", wrong: "Can we prepone the meeting to 10?" },
      { right: "I have been working here for three years.", wrong: "I am working here since three years." },
      { right: "What is your good name?", note: "Sounds odd abroad — just ask \"What's your name?\"" },
    ],
    quiz: [
      mcq("Which sentence is correct?", ["We discussed about the issue.", "We discussed the issue.", "We discussed on the issue.", "We did discussion about the issue."], 1, "\"Discuss\" takes a direct object — no \"about\"."),
      mcq("Which is the best email ending?", ["Kindly revert back.", "Do the needful.", "I look forward to your reply.", "Revert back at the earliest."], 2, "\"I look forward to your reply\" is clear and natural everywhere."),
      mcq("I ___ in Bengaluru since 2019.", ["am living", "live", "have been living", "was living"], 2, "With \"since\" + a starting point, use the present perfect (continuous)."),
      blank("Please ___ the meeting forward to Tuesday. (one word: verb)", ["bring", "move"], "\"Bring/move a meeting forward\" is the international alternative to \"prepone\"."),
      mcq("Which sentence avoids redundancy?", ["Please repeat it again.", "He returned back home.", "She returned home.", "Let's cope up with it."], 2, "\"Returned home\" — \"back\" would repeat the meaning."),
    ],
  },
  {
    id: "reported-speech",
    title: "Reported speech",
    level: "advanced",
    summary: "Telling someone what another person said.",
    rules: [
      "After a past reporting verb (said, told), move tenses one step back: \"I am tired\" → She said she was tired.",
      "will → would, can → could, is → was, has done → had done, did → had done.",
      "Change pronouns and time words: \"I'll come tomorrow\" → He said he would come the next day.",
      "\"Say\" doesn't take a person directly; \"tell\" does: She said (that)… / She told me (that)…",
      "Questions become statements: \"Where do you live?\" → He asked where I lived.",
    ],
    examples: [
      { right: "He said he was busy.", wrong: "He said he is busy.", note: "Fine if it's still true, but the backshift is the safe default." },
      { right: "She told me she would call.", wrong: "She said me she would call." },
      { right: "They asked where the station was.", wrong: "They asked where was the station." },
    ],
    quiz: [
      mcq("\"I can swim.\" → He said he ___ swim.", ["can", "could", "can to", "will"], 1, "can → could in reported speech."),
      mcq("Which is correct?", ["She said me the truth.", "She told me the truth.", "She told to me the truth.", "She said to me the truth that."], 1, "\"Tell\" takes a person directly: told me."),
      mcq("\"Where do you work?\" → She asked me where ___.", ["do I work", "I worked", "did I work", "I do work"], 1, "Reported questions use statement word order and a backshift."),
      blank("\"I will finish it.\" → He said he ___ finish it.", ["would"], "will → would."),
      mcq("\"We met yesterday.\" → They said they had met ___.", ["yesterday", "the day before", "tomorrow", "today"], 1, "yesterday → the day before (or the previous day)."),
    ],
  },
  {
    id: "past-tenses",
    title: "Past simple vs present perfect",
    level: "advanced",
    summary: "Finished time vs experience and results that matter now.",
    rules: [
      "Past simple for finished time: I saw her yesterday / in 2020 / last week.",
      "Present perfect (have/has + past participle) for experience or a result that matters now, without a finished time: I've lost my keys.",
      "Never use the present perfect with a finished-time word: not \"I have seen her yesterday\".",
      "Use the present perfect with for/since/already/yet/ever/just: Have you ever been to Kerala?",
    ],
    examples: [
      { right: "I went to Jaipur last year.", wrong: "I have gone to Jaipur last year." },
      { right: "I've already eaten.", note: "Result now — I'm not hungry." },
      { right: "Have you finished the report yet?" },
    ],
    quiz: [
      mcq("I ___ him last Monday.", ["have met", "met", "have been meeting", "meet"], 1, "\"Last Monday\" is finished time → past simple."),
      mcq("___ you ever ___ sushi?", ["Did / eat", "Have / eaten", "Do / eat", "Have / ate"], 1, "Life experience with \"ever\" → present perfect."),
      mcq("She ___ here since March.", ["works", "worked", "has worked", "is working"], 2, "\"Since\" + start point → present perfect."),
      blank("Oh no! I ___ (lose) my wallet.", ["have lost", "'ve lost"], "A past action with a result now → present perfect."),
      mcq("When ___ you arrive?", ["have", "did", "has", "do"], 1, "\"When\" asks about a finished time → past simple."),
    ],
  },
]

/* --------------------------------------------------------- writing tasks */

export interface WritingPrompt {
  id: string
  level: EnglishLevel
  title: string
  hint: string
}

export const WRITING_PROMPTS: WritingPrompt[] = [
  { id: "morning", level: "beginner", title: "Describe your morning routine", hint: "What time do you wake up? What do you eat? How do you get to work or school?" },
  { id: "family", level: "beginner", title: "Introduce your family", hint: "Who is in your family? What do they do? What do you enjoy doing together?" },
  { id: "weekend", level: "beginner", title: "What did you do last weekend?", hint: "Use the past tense: went, saw, ate, met…" },
  { id: "food", level: "beginner", title: "Your favourite food", hint: "What is it, how is it made, and when do you eat it?" },
  { id: "city", level: "beginner", title: "Describe your city or town", hint: "Where is it? What is it famous for? What do you like and dislike?" },
  { id: "friend", level: "beginner", title: "Write about your best friend", hint: "How did you meet? What are they like?" },
  { id: "festival", level: "beginner", title: "Your favourite festival", hint: "How do you celebrate it? What food, clothes or traditions are special?" },
  { id: "leave", level: "intermediate", title: "Write an email asking for leave", hint: "Greeting, dates, reason, who will cover your work, polite closing." },
  { id: "complaint", level: "intermediate", title: "Complain about a late delivery", hint: "Order details, what went wrong, what you want them to do." },
  { id: "trip", level: "intermediate", title: "Describe a memorable trip", hint: "Where, when, who with — and why it was memorable." },
  { id: "goal", level: "intermediate", title: "A goal for this year and your plan", hint: "Be specific: what, why, and the steps you'll take." },
  { id: "intro", level: "intermediate", title: "Introduce yourself for a job interview", hint: "Background, experience, strengths, why this role." },
  { id: "thank-you", level: "intermediate", title: "A thank-you note to a colleague", hint: "What did they do and how did it help you?" },
  { id: "phone", level: "intermediate", title: "Should children have smartphones?", hint: "Give your view with two reasons and an example." },
  { id: "reschedule", level: "intermediate", title: "Email to reschedule a meeting", hint: "Apologise, explain briefly, suggest two new times." },
  { id: "remote", level: "advanced", title: "Your opinion on remote work", hint: "Weigh productivity, wellbeing and collaboration; conclude clearly." },
  { id: "ai-jobs", level: "advanced", title: "Will AI create or destroy more jobs?", hint: "Present both sides, then argue your position." },
  { id: "proposal", level: "advanced", title: "Propose a process improvement at work", hint: "Problem, proposed change, expected benefits, risks." },
  { id: "city-problem", level: "advanced", title: "Solving traffic in big cities", hint: "Analyse causes, then suggest realistic solutions." },
  { id: "feedback", level: "advanced", title: "Give constructive feedback to a team member", hint: "Be specific, kind and actionable." },
  { id: "book", level: "advanced", title: "Review a book, film or series", hint: "Summary without spoilers, strengths, weaknesses, recommendation." },
  { id: "education", level: "advanced", title: "Exams vs projects: how should students be assessed?", hint: "Compare both approaches and justify your view." },
]

/* -------------------------------------------------------------- speaking */

export interface SpeakingSentence {
  id: string
  level: EnglishLevel
  text: string
  /** What to focus on while speaking. */
  focus?: string
}

export const SPEAKING_SENTENCES: SpeakingSentence[] = [
  { id: "s1", level: "beginner", text: "Good morning, how are you today?", focus: "Rising tone at the end of the question." },
  { id: "s2", level: "beginner", text: "I would like a cup of tea, please.", focus: "\"would like\" — the l in \"would\" is silent." },
  { id: "s3", level: "beginner", text: "Can you tell me the way to the station?" },
  { id: "s4", level: "beginner", text: "My name is Asha and I live in Pune." },
  { id: "s5", level: "beginner", text: "It is very hot this afternoon.", focus: "Clear \"h\" in hot." },
  { id: "s6", level: "beginner", text: "Thank you very much for your help.", focus: "\"th\" — put your tongue between your teeth." },
  { id: "s7", level: "beginner", text: "What time does the shop open?" },
  { id: "s8", level: "beginner", text: "I usually walk to work in the morning." },
  { id: "s9", level: "intermediate", text: "Could you please send me the report by Friday?" },
  { id: "s10", level: "intermediate", text: "I'm sorry, I didn't catch that. Could you repeat it?" },
  { id: "s11", level: "intermediate", text: "The weather forecast says it will rain tomorrow." },
  { id: "s12", level: "intermediate", text: "We should leave early to avoid the traffic.", focus: "Link \"leave early\" smoothly." },
  { id: "s13", level: "intermediate", text: "I have been working on this project for three months." },
  { id: "s14", level: "intermediate", text: "Would it be possible to move the meeting to Thursday?" },
  { id: "s15", level: "intermediate", text: "She thinks the third theory is the best one.", focus: "Many \"th\" sounds — go slowly." },
  { id: "s16", level: "intermediate", text: "Let me check my calendar and get back to you." },
  { id: "s17", level: "advanced", text: "Despite the setback, the team delivered the project on schedule." },
  { id: "s18", level: "advanced", text: "In my opinion, flexible working hours improve both productivity and wellbeing." },
  { id: "s19", level: "advanced", text: "The proposal was comprehensive, albeit slightly ambitious." },
  { id: "s20", level: "advanced", text: "We need to prioritise the tasks that have the greatest impact." },
  { id: "s21", level: "advanced", text: "Could you elaborate on the risks you mentioned earlier?" },
  { id: "s22", level: "advanced", text: "The results were unprecedented, so we scrutinised the data carefully." },
  { id: "s23", level: "advanced", text: "Effective communication requires listening as much as speaking." },
  { id: "s24", level: "advanced", text: "Particularly in winter, the weather can deteriorate very quickly." },
]

/* ------------------------------------------- offline checker confusions */

export interface Confusion {
  pattern: RegExp
  message: string
  suggestion: string
}

/** Common confusions / redundancies flagged by the offline writing checker. */
export const CONFUSIONS: Confusion[] = [
  { pattern: /\byour (welcome|going|right|wrong|not|very|so|the best)\b/gi, message: "\"your\" shows possession; \"you're\" = you are.", suggestion: "you're" },
  { pattern: /\byou're (car|house|name|phone|family|job|work|friend|own)\b/gi, message: "\"you're\" = you are; use \"your\" for possession.", suggestion: "your" },
  { pattern: /\bits (a|an|the|not|been|very|so|going|time|important|true|raining)\b/gi, message: "\"its\" is possessive; \"it's\" = it is / it has.", suggestion: "it's" },
  { pattern: /\bit's own\b/gi, message: "Possessive \"its\" has no apostrophe.", suggestion: "its own" },
  { pattern: /\b(more|less|better|worse|rather|bigger|smaller|faster|slower|higher|lower|greater|older|younger|other) then\b/gi, message: "Use \"than\" for comparisons; \"then\" is about time.", suggestion: "than" },
  { pattern: /\btheir (is|are|was|were)\b/gi, message: "\"their\" shows belonging; use \"there is/are\" for existence.", suggestion: "there" },
  { pattern: /\bdiscuss(ed|es|ing)? about\b/gi, message: "\"discuss\" takes a direct object — drop \"about\".", suggestion: "discuss" },
  { pattern: /\brevert(ed|ing)? back\b/gi, message: "\"revert back\" is redundant; try \"reply\" or \"get back to you\".", suggestion: "reply / get back to" },
  { pattern: /\breturn(ed|ing|s)? back\b/gi, message: "\"return back\" is redundant.", suggestion: "return" },
  { pattern: /\brepeat(ed|ing|s)? again\b/gi, message: "\"repeat again\" is redundant.", suggestion: "repeat" },
  { pattern: /\bcope up with\b/gi, message: "The phrase is \"cope with\".", suggestion: "cope with" },
  { pattern: /\bdo the needful\b/gi, message: "Unclear outside India — say exactly what you need.", suggestion: "please take care of this" },
  { pattern: /\bprepone(d)?\b/gi, message: "\"Prepone\" isn't understood internationally.", suggestion: "bring forward" },
  { pattern: /\b(could|should|would|must) of\b/gi, message: "It's \"could have\" (could've), not \"could of\".", suggestion: "could have" },
  { pattern: /\balot\b/gi, message: "\"A lot\" is two words.", suggestion: "a lot" },
  { pattern: /\bsince (\d+|two|three|four|five|six|seven|eight|nine|ten|many|several) (years|months|weeks|days|hours)\b/gi, message: "Use \"for\" with a length of time; \"since\" with a starting point.", suggestion: "for" },
  { pattern: /\b(advices|informations|furnitures|luggages|equipments|feedbacks)\b/gi, message: "This noun is uncountable — no plural -s.", suggestion: "remove the -s" },
  { pattern: /\bmyself is\b/gi, message: "Use \"I am\" / \"My name is\", not \"myself is\".", suggestion: "My name is" },
]

/**
 * Built-in content for the Logic & Reasoning track: the puzzle bank (also the
 * source of the daily puzzle) and the "Thinking skills" mini-lessons.
 * Everything here works offline; AI is an optional extra.
 */

export type PuzzleCategory = "sequence" | "deduction" | "lateral" | "math" | "grid" | "syllogism"
export type Difficulty = "easy" | "medium" | "hard"

export interface LogicPuzzle {
  id: string
  category: PuzzleCategory
  difficulty: Difficulty
  title: string
  puzzle: string
  hint: string
  answer: string
  /** Other answers that should be accepted (compared after normalisation). */
  accept?: string[]
  explanation: string
}

export const PUZZLE_CATEGORIES: Record<PuzzleCategory, { label: string; description: string }> = {
  sequence: { label: "Sequences", description: "Spot the rule, find the next term" },
  deduction: { label: "Deduction", description: "Reason from clues to a certain answer" },
  lateral: { label: "Riddles", description: "Lateral thinking and wordplay" },
  math: { label: "Word problems", description: "Maths hidden in a story" },
  grid: { label: "Logic grids", description: "Match people to things with clues" },
  syllogism: { label: "Syllogisms", description: "Does the conclusion really follow?" },
}

export const DIFFICULTIES: Record<Difficulty, { label: string; xp: number }> = {
  easy: { label: "Easy", xp: 5 },
  medium: { label: "Medium", xp: 10 },
  hard: { label: "Hard", xp: 15 },
}

/** Fraction of XP lost when the hint was used. */
export const HINT_PENALTY = 0.4
/** Bonus XP for solving the daily puzzle. */
export const DAILY_BONUS_XP = 15

export function puzzleXp(difficulty: Difficulty, hintUsed: boolean): number {
  const base = DIFFICULTIES[difficulty].xp
  return hintUsed ? Math.round(base * (1 - HINT_PENALTY)) : base
}

const YES = ["yes", "y", "it follows", "follows", "true", "valid", "yes it follows", "yes it does"]
const NO = ["no", "n", "does not follow", "doesnt follow", "not necessarily", "false", "invalid", "cannot tell", "cant tell", "no it doesnt", "no not necessarily", "no it does not"]

export const PUZZLES: LogicPuzzle[] = [
  /* ---------------------------------------------------------------- sequences */
  {
    id: "seq-doubling",
    category: "sequence",
    difficulty: "easy",
    title: "Doubling up",
    puzzle: "What comes next? 2, 4, 8, 16, …",
    hint: "Compare each number with the one before it.",
    answer: "32",
    explanation: "Each term is double the previous one: 16 × 2 = 32.",
  },
  {
    id: "seq-squares",
    category: "sequence",
    difficulty: "easy",
    title: "Perfect squares",
    puzzle: "What comes next? 1, 4, 9, 16, 25, …",
    hint: "Try 1×1, 2×2, 3×3…",
    answer: "36",
    explanation: "These are the square numbers 1², 2², 3², 4², 5². Next is 6² = 36.",
  },
  {
    id: "seq-fibonacci",
    category: "sequence",
    difficulty: "medium",
    title: "Rabbit numbers",
    puzzle: "What comes next? 1, 1, 2, 3, 5, 8, 13, …",
    hint: "Look at two neighbouring terms together.",
    answer: "21",
    explanation: "Each term is the sum of the two before it (Fibonacci): 8 + 13 = 21.",
  },
  {
    id: "seq-growing-gaps",
    category: "sequence",
    difficulty: "medium",
    title: "Growing gaps",
    puzzle: "What comes next? 3, 6, 11, 18, 27, …",
    hint: "Write down the differences between terms.",
    answer: "38",
    explanation: "The differences are 3, 5, 7, 9 — consecutive odd numbers. The next difference is 11, so 27 + 11 = 38.",
  },
  {
    id: "seq-months",
    category: "sequence",
    difficulty: "medium",
    title: "Letters of the year",
    puzzle: "Which letter comes next? J, F, M, A, M, J, J, …",
    hint: "Think about the calendar.",
    answer: "A",
    accept: ["august", "a for august"],
    explanation: "They are the first letters of the months: January, February, March, April, May, June, July — next is August.",
  },
  {
    id: "seq-primes",
    category: "sequence",
    difficulty: "medium",
    title: "Indivisible",
    puzzle: "What comes next? 2, 3, 5, 7, 11, 13, …",
    hint: "Each number can only be divided evenly by 1 and itself.",
    answer: "17",
    explanation: "These are the prime numbers. After 13, 14–16 all have factors, so the next prime is 17.",
  },
  {
    id: "seq-number-letters",
    category: "sequence",
    difficulty: "hard",
    title: "Counting letters",
    puzzle: "Which letter comes next? O, T, T, F, F, S, S, E, …",
    hint: "Say the numbers one, two, three… out loud.",
    answer: "N",
    accept: ["nine", "n for nine"],
    explanation: "They're the first letters of One, Two, Three, Four, Five, Six, Seven, Eight — next is Nine.",
  },
  {
    id: "seq-factorial",
    category: "sequence",
    difficulty: "hard",
    title: "Multiplying faster",
    puzzle: "What comes next? 1, 2, 6, 24, 120, …",
    hint: "Divide each term by the one before it.",
    answer: "720",
    explanation: "Each term is multiplied by the next whole number: ×2, ×3, ×4, ×5, then ×6 → 120 × 6 = 720 (these are factorials).",
  },
  {
    id: "seq-look-and-say",
    category: "sequence",
    difficulty: "hard",
    title: "Look and say",
    puzzle: "What comes next? 1, 11, 21, 1211, 111221, …",
    hint: "Read each term aloud describing the one before: “one 1” → 11.",
    answer: "312211",
    explanation: "Each term describes the previous one. 111221 is “three 1s, two 2s, one 1” → 312211.",
  },

  /* ---------------------------------------------------------------- deduction */
  {
    id: "ded-tallest",
    category: "deduction",
    difficulty: "easy",
    title: "Who is tallest?",
    puzzle: "Alice is taller than Ben. Cara is shorter than Ben. Who is the tallest?",
    hint: "Put the three names in a line from shortest to tallest.",
    answer: "Alice",
    explanation: "Cara < Ben < Alice, so Alice is the tallest.",
  },
  {
    id: "ded-second-youngest",
    category: "deduction",
    difficulty: "easy",
    title: "Second youngest",
    puzzle: "Tom is older than Jack. Jack is older than Liam. Liam is older than Noah. Who is the second youngest?",
    hint: "Order all four from oldest to youngest.",
    answer: "Liam",
    explanation: "Oldest to youngest: Tom, Jack, Liam, Noah. Noah is youngest, so Liam is second youngest.",
  },
  {
    id: "ded-uncle",
    category: "deduction",
    difficulty: "easy",
    title: "Family ties",
    puzzle: "Paul is Kate's brother. Kate is Lena's mother. What is Paul to Lena?",
    hint: "What do you call your mother's brother?",
    answer: "uncle",
    accept: ["her uncle", "lenas uncle"],
    explanation: "Paul is the brother of Lena's mother, which makes him Lena's uncle.",
  },
  {
    id: "ded-race",
    category: "deduction",
    difficulty: "medium",
    title: "Finishing order",
    puzzle: "Five people ran a race. Hal finished first. Dan finished before Eve but after Finn. Gus finished after Eve. Who finished last?",
    hint: "Start with Hal, then chain the other clues: Finn → Dan → Eve → …",
    answer: "Gus",
    explanation: "Hal is first. Finn comes before Dan, Dan before Eve, and Eve before Gus. The order is Hal, Finn, Dan, Eve, Gus — Gus is last.",
  },
  {
    id: "ded-knights",
    category: "deduction",
    difficulty: "medium",
    title: "Knights and knaves",
    puzzle: "On an island, knights always tell the truth and knaves always lie. A says: “We are both knaves.” Is B a knight or a knave?",
    hint: "Could a knight ever say “I am a knave”?",
    answer: "knight",
    accept: ["b is knight", "b knight"],
    explanation: "If A were a knight, the statement “we are both knaves” would be a lie — impossible. So A is a knave and the statement is false, meaning they are not both knaves. Since A is a knave, B must be a knight.",
  },
  {
    id: "ded-fruit-boxes",
    category: "deduction",
    difficulty: "medium",
    title: "Mislabelled boxes",
    puzzle: "Three boxes are labelled “Apples”, “Oranges” and “Mixed”. Every label is wrong. You may take one fruit from one box without looking inside. Which box should you pick from to work out all the labels?",
    hint: "Which box can't possibly contain a mix?",
    answer: "Mixed",
    accept: ["the mixed box", "mixed box", "box labelled mixed", "labelled mixed", "one labelled mixed"],
    explanation: "The box labelled “Mixed” must hold only apples or only oranges. If you pull an apple, it's the apples box. The box labelled “Oranges” can't be oranges or apples now, so it's mixed, and the last box is oranges.",
  },
  {
    id: "ded-cookie",
    category: "deduction",
    difficulty: "hard",
    title: "The cookie thief",
    puzzle: "One of Ravi, Sara and Theo stole the cookie. Ravi says: “Theo did it.” Sara says: “I didn't do it.” Theo says: “Ravi is lying.” Exactly one of them is telling the truth. Who stole the cookie?",
    hint: "Test each suspect in turn and count how many statements would be true.",
    answer: "Sara",
    explanation: "If Ravi did it: Sara and Theo tell the truth (2 true). If Theo did it: Ravi and Sara tell the truth (2 true). If Sara did it: only Theo's statement is true (1 true). So Sara is the thief.",
  },
  {
    id: "ded-photo",
    category: "deduction",
    difficulty: "hard",
    title: "The portrait",
    puzzle: "A man looks at a portrait and says: “Brothers and sisters I have none, but that man's father is my father's son.” Who is in the portrait?",
    hint: "Who is “my father's son” if he has no brothers?",
    answer: "his son",
    accept: ["son", "my son", "the mans son", "his own son"],
    explanation: "With no brothers, “my father's son” is the speaker himself. So the portrait man's father is the speaker — the portrait shows his son.",
  },

  /* ---------------------------------------------------------------- lateral */
  {
    id: "lat-mia",
    category: "lateral",
    difficulty: "easy",
    title: "Four children",
    puzzle: "Mia's mother has four children: April, May, June and …?",
    hint: "Re-read the first two words.",
    answer: "Mia",
    explanation: "It's Mia's mother, so Mia is the fourth child. The month names are a distraction.",
  },
  {
    id: "lat-keys",
    category: "lateral",
    difficulty: "easy",
    title: "Keys without locks",
    puzzle: "What has keys but can't open locks?",
    hint: "Think of music.",
    answer: "piano",
    accept: ["keyboard", "a keyboard", "computer keyboard"],
    explanation: "A piano (or a keyboard) has keys, but they play notes or type letters rather than open locks.",
  },
  {
    id: "lat-footsteps",
    category: "lateral",
    difficulty: "easy",
    title: "Take and leave",
    puzzle: "The more you take, the more you leave behind. What are they?",
    hint: "Think about walking on a beach.",
    answer: "footsteps",
    accept: ["steps", "footprints", "footstep", "foot steps", "foot prints"],
    explanation: "Every step you take leaves a footstep (footprint) behind you.",
  },
  {
    id: "lat-towel",
    category: "lateral",
    difficulty: "easy",
    title: "Wetter as it dries",
    puzzle: "What gets wetter the more it dries?",
    hint: "You use it after a shower.",
    answer: "towel",
    accept: ["bath towel"],
    explanation: "A towel gets wetter the more things it dries.",
  },
  {
    id: "lat-stamp",
    category: "lateral",
    difficulty: "medium",
    title: "World traveller",
    puzzle: "What can travel around the world while staying in a corner?",
    hint: "Think about letters and envelopes.",
    answer: "stamp",
    accept: ["postage stamp", "a stamp"],
    explanation: "A postage stamp sits in the corner of an envelope while it travels the world.",
  },
  {
    id: "lat-months-28",
    category: "lateral",
    difficulty: "medium",
    title: "28 days",
    puzzle: "Some months have 31 days and some have 30. How many months have 28 days?",
    hint: "Does a 31-day month contain a 28th day?",
    answer: "12",
    accept: ["all", "all of them", "every month", "all 12"],
    explanation: "Every month has at least 28 days, so all 12 months have 28 days.",
  },
  {
    id: "lat-secret",
    category: "lateral",
    difficulty: "medium",
    title: "Share me",
    puzzle: "If you have me, you want to share me. If you share me, you haven't got me. What am I?",
    hint: "Shh…",
    answer: "secret",
    accept: ["a secret"],
    explanation: "Once you share a secret, it's no longer a secret you keep.",
  },
  {
    id: "lat-monopoly",
    category: "lateral",
    difficulty: "medium",
    title: "Bankrupt at the hotel",
    puzzle: "A man pushes his car up to a hotel and immediately knows he is bankrupt. How?",
    hint: "The car might be very small.",
    answer: "monopoly",
    accept: ["playing monopoly", "board game", "he is playing monopoly", "a board game"],
    explanation: "He's playing Monopoly: his car token landed on a property with a hotel he can't afford.",
  },
  {
    id: "lat-rooster",
    category: "lateral",
    difficulty: "hard",
    title: "Rooster on the roof",
    puzzle: "A rooster lays an egg exactly on the peak of a barn roof. Which side does the egg roll down?",
    hint: "Check the assumption in the question.",
    answer: "neither",
    accept: ["none", "nowhere", "roosters dont lay eggs", "rooster dont lay eggs", "it doesnt", "no side", "neither side", "roosters do not lay eggs"],
    explanation: "Roosters are male chickens — they don't lay eggs, so there's no egg to roll.",
  },
  {
    id: "lat-survivors",
    category: "lateral",
    difficulty: "hard",
    title: "On the border",
    puzzle: "A plane crashes exactly on the border between two countries. In which country do they bury the survivors?",
    hint: "Read the last word again.",
    answer: "nowhere",
    accept: ["neither", "none", "you dont bury survivors", "dont bury survivors", "they dont", "you do not bury survivors", "neither country"],
    explanation: "Survivors are alive — you don't bury them at all.",
  },

  /* ---------------------------------------------------------------- maths */
  {
    id: "math-sheep",
    category: "math",
    difficulty: "easy",
    title: "Runaway sheep",
    puzzle: "A farmer has 17 sheep. All but 9 run away. How many sheep are left?",
    hint: "“All but 9” means everything except 9.",
    answer: "9",
    explanation: "All except 9 ran away, so 9 sheep remain.",
  },
  {
    id: "math-discount",
    category: "math",
    difficulty: "easy",
    title: "Sale price",
    puzzle: "A shirt costs $40 and is discounted by 25%. What is the sale price in dollars?",
    hint: "25% is one quarter.",
    answer: "30",
    explanation: "25% of 40 is 10, so the price drops to 40 − 10 = $30.",
  },
  {
    id: "math-bat-ball",
    category: "math",
    difficulty: "easy",
    title: "Bat and ball",
    puzzle: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How many cents does the ball cost?",
    hint: "If the ball were 10¢, the bat would be $1.10 — check the total.",
    answer: "5",
    accept: ["0.05"],
    explanation: "Let the ball be x. Then the bat is x + 1.00 and 2x + 1.00 = 1.10, so x = 0.05. The ball costs 5 cents (not the intuitive 10).",
  },
  {
    id: "math-overtake",
    category: "math",
    difficulty: "medium",
    title: "Overtaking",
    puzzle: "In a race you overtake the person in 2nd place. What place are you in now?",
    hint: "You took their spot — not the leader's.",
    answer: "2",
    explanation: "Passing the runner in 2nd puts you in 2nd place; the leader is still ahead.",
  },
  {
    id: "math-machines",
    category: "math",
    difficulty: "medium",
    title: "Widget machines",
    puzzle: "If 5 machines take 5 minutes to make 5 widgets, how many minutes would 100 machines take to make 100 widgets?",
    hint: "How long does one machine take to make one widget?",
    answer: "5",
    explanation: "Each machine makes one widget in 5 minutes. 100 machines working in parallel make 100 widgets in the same 5 minutes.",
  },
  {
    id: "math-lily-pads",
    category: "math",
    difficulty: "medium",
    title: "Lily pads",
    puzzle: "A patch of lily pads doubles in size every day. It covers the whole lake on day 48. On which day did it cover half the lake?",
    hint: "Work backwards one day.",
    answer: "47",
    explanation: "Since it doubles daily, it was half the size the day before it covered everything: day 47.",
  },
  {
    id: "math-half",
    category: "math",
    difficulty: "medium",
    title: "Dividing by a half",
    puzzle: "Divide 30 by one half, then add 10. What do you get?",
    hint: "Dividing by ½ is not the same as halving.",
    answer: "70",
    explanation: "30 ÷ ½ = 60 (how many halves fit in 30), and 60 + 10 = 70.",
  },
  {
    id: "math-ages",
    category: "math",
    difficulty: "medium",
    title: "Twice as old",
    puzzle: "Sara is twice as old as Ben. In 10 years, their ages will add up to 50. How old is Sara now?",
    hint: "Call Ben's age b; Sara is 2b. Both get 10 years older.",
    answer: "20",
    explanation: "2b + b + 20 = 50, so 3b = 30 and b = 10. Sara is 2 × 10 = 20.",
  },
  {
    id: "math-snail",
    category: "math",
    difficulty: "hard",
    title: "Snail in a well",
    puzzle: "A snail is at the bottom of a 10 m well. Each day it climbs up 3 m, and each night it slips back 2 m. On which day does it reach the top?",
    hint: "Once it reaches the top during the day, it doesn't slip back.",
    answer: "8",
    explanation: "It gains 1 m per full day, so after 7 days and nights it's at 7 m. On day 8 it climbs 3 m to reach 10 m before it can slip.",
  },
  {
    id: "math-clock-angle",
    category: "math",
    difficulty: "hard",
    title: "Clock hands",
    puzzle: "A clock shows 3:15. What is the smaller angle between the hour and minute hands, in degrees?",
    hint: "The hour hand doesn't stay exactly on the 3 — it moves 30° per hour.",
    answer: "7.5",
    explanation: "The minute hand is on 3 (90°). The hour hand has moved a quarter of the way from 3 to 4: 90° + 7.5° = 97.5°. The difference is 7.5°.",
  },

  /* ---------------------------------------------------------------- logic grids */
  {
    id: "grid-cups",
    category: "grid",
    difficulty: "easy",
    title: "Balls in cups",
    puzzle: "A red, a green and a blue ball are hidden in cups 1, 2 and 3 (one per cup). The red ball is not in cup 1. The blue ball is in cup 3. Which cup holds the green ball?",
    hint: "Place the blue ball first.",
    answer: "1",
    accept: ["cup 1", "first cup", "cup one"],
    explanation: "Blue is in cup 3. Red isn't in cup 1, so red is in cup 2, leaving cup 1 for green.",
  },
  {
    id: "grid-houses",
    category: "grid",
    difficulty: "easy",
    title: "Coloured houses",
    puzzle: "A red, a blue and a green house stand in a row. The green house is on the far right. The red house is somewhere to the left of the blue house. Which house is in the middle?",
    hint: "Two houses are left for two spots.",
    answer: "blue",
    accept: ["blue house", "the blue one"],
    explanation: "Green takes the right. Red must be left of blue, so red is on the left and blue is in the middle.",
  },
  {
    id: "grid-drinks",
    category: "grid",
    difficulty: "medium",
    title: "Morning drinks",
    puzzle: "Kim, Leo and Max each ordered one of tea, coffee and juice. Kim avoids caffeine. Leo didn't order tea. What did Max order?",
    hint: "Which drink has no caffeine?",
    answer: "tea",
    explanation: "Kim avoids caffeine, so Kim has juice. Leo didn't order tea, so Leo has coffee. Max has tea.",
  },
  {
    id: "grid-ages",
    category: "grid",
    difficulty: "medium",
    title: "Three ages",
    puzzle: "Priya, Quinn and Rosa are 20, 25 and 30 years old (one each). Quinn is older than Priya. Priya is not the youngest. How old is Rosa?",
    hint: "If Priya isn't youngest but someone is older than her…",
    answer: "20",
    explanation: "Priya isn't the youngest, and Quinn is older than her, so Priya is 25 and Quinn is 30. Rosa is 20.",
  },
  {
    id: "grid-pets",
    category: "grid",
    difficulty: "medium",
    title: "Who owns the cat?",
    puzzle: "Ana, Ben, Cy and Dee each own a different pet: a cat, a dog, a fish or a bird. Ana owns neither the cat nor the dog. Ben owns the bird. Cy doesn't own the cat. Who owns the cat?",
    hint: "Ben's pet is known — what's left for Ana?",
    answer: "Dee",
    explanation: "Ben has the bird, so Ana (no cat, no dog) has the fish. Cy can't have the cat, so Cy has the dog. Dee has the cat.",
  },
  {
    id: "grid-prize-boxes",
    category: "grid",
    difficulty: "medium",
    title: "One true label",
    puzzle: "A prize is in one of three boxes. Gold says: “The prize is here.” Silver says: “The prize is not here.” Bronze says: “The prize is not in Gold.” Only one statement is true. Where is the prize?",
    hint: "Try the prize in each box and count the true statements.",
    answer: "silver",
    accept: ["silver box", "in silver", "the silver box"],
    explanation: "In Gold → Gold and Silver are true (2). In Bronze → Silver and Bronze are true (2). In Silver → only Bronze is true (1). So it's in Silver.",
  },
  {
    id: "grid-runners",
    category: "grid",
    difficulty: "hard",
    title: "Runner numbers",
    puzzle: "Four runners in red, blue, green and yellow wear the numbers 1–4. Yellow wears 1. Red wears an even number. Blue's number is one more than Green's. Red's number is higher than Blue's. What number does Green wear?",
    hint: "Only 2, 3 and 4 are left for red, blue and green.",
    answer: "2",
    explanation: "Green and Blue are consecutive, and Red must be even and higher than Blue. Green 2, Blue 3, Red 4 is the only arrangement that works.",
  },
  {
    id: "grid-seats",
    category: "grid",
    difficulty: "hard",
    title: "Four seats",
    puzzle: "Ann, Bo, Cal and Di sit in a row of four seats. Ann sits in the left-most seat. Di is not at either end. Bo sits directly next to Di. Cal is not next to Di. Who sits in the right-most seat?",
    hint: "Di must be in seat 2 or 3 — try both.",
    answer: "Cal",
    explanation: "If Di were in seat 3, Cal would be in seat 2 or 4 — both next to Di. So Di is in seat 2, Bo must be in seat 3 (seat 1 is Ann's), and Cal takes seat 4.",
  },

  /* ---------------------------------------------------------------- syllogisms */
  {
    id: "syl-cats",
    category: "syllogism",
    difficulty: "easy",
    title: "Cats and animals",
    puzzle: "All cats are mammals. All mammals are animals. Conclusion: all cats are animals. Does the conclusion necessarily follow? (yes / no)",
    hint: "Picture circles inside circles.",
    answer: "yes",
    accept: YES,
    explanation: "Cats sit inside mammals, which sit inside animals — so every cat is an animal. Valid.",
  },
  {
    id: "syl-sharks",
    category: "syllogism",
    difficulty: "easy",
    title: "Sharks and mammals",
    puzzle: "No fish are mammals. All sharks are fish. Conclusion: no sharks are mammals. Does the conclusion necessarily follow? (yes / no)",
    hint: "Sharks are entirely inside the fish group.",
    answer: "yes",
    accept: YES,
    explanation: "Every shark is a fish and no fish is a mammal, so no shark can be a mammal. Valid.",
  },
  {
    id: "syl-roses",
    category: "syllogism",
    difficulty: "medium",
    title: "Fading roses",
    puzzle: "All roses are flowers. Some flowers fade quickly. Conclusion: some roses fade quickly. Does the conclusion necessarily follow? (yes / no)",
    hint: "Could the quickly fading flowers all be tulips?",
    answer: "no",
    accept: NO,
    explanation: "The flowers that fade quickly might not include any roses. The premises allow it but don't force it — invalid.",
  },
  {
    id: "syl-doctors",
    category: "syllogism",
    difficulty: "medium",
    title: "Sam the graduate",
    puzzle: "All doctors are graduates. Sam is a graduate. Conclusion: Sam is a doctor. Does the conclusion necessarily follow? (yes / no)",
    hint: "Are there graduates who aren't doctors?",
    answer: "no",
    accept: NO,
    explanation: "Being a graduate doesn't make someone a doctor — plenty of graduates aren't. This is the fallacy of affirming the consequent.",
  },
  {
    id: "syl-rain",
    category: "syllogism",
    difficulty: "medium",
    title: "Dry ground",
    puzzle: "If it rains, the ground gets wet. The ground is not wet. Conclusion: it did not rain. Does the conclusion necessarily follow? (yes / no)",
    hint: "If it had rained, what would we see?",
    answer: "yes",
    accept: YES,
    explanation: "Rain would have made the ground wet. Since it isn't wet, it can't have rained. This valid form is called modus tollens.",
  },
  {
    id: "syl-pass",
    category: "syllogism",
    difficulty: "medium",
    title: "Passing the test",
    puzzle: "If you study, you pass. You passed. Conclusion: you studied. Does the conclusion necessarily follow? (yes / no)",
    hint: "Could you pass for some other reason?",
    answer: "no",
    accept: NO,
    explanation: "The rule says studying guarantees a pass, not that passing requires studying. Affirming the consequent — invalid.",
  },
  {
    id: "syl-artists",
    category: "syllogism",
    difficulty: "hard",
    title: "Creative artists",
    puzzle: "Some artists are musicians. All musicians are creative. Conclusion: some artists are creative. Does the conclusion necessarily follow? (yes / no)",
    hint: "Focus on the artists who are musicians.",
    answer: "yes",
    accept: YES,
    explanation: "The artists who are musicians must be creative (all musicians are), so at least some artists are creative. Valid.",
  },
  {
    id: "syl-abc",
    category: "syllogism",
    difficulty: "hard",
    title: "A, B and C",
    puzzle: "All A are B. Some B are not C. Conclusion: some A are not C. Does the conclusion necessarily follow? (yes / no)",
    hint: "The B's that aren't C might be B's that aren't A.",
    answer: "no",
    accept: NO,
    explanation: "The B's that aren't C could all lie outside A. E.g. all dogs are animals, some animals are not mammals — but every dog is a mammal. Invalid.",
  },
]

/* ------------------------------------------------------------------ thinking skills */

export interface QuizQuestion {
  q: string
  options: string[]
  correct: number
  why: string
}

export interface ThinkingLesson {
  id: string
  title: string
  summary: string
  minutes: number
  sections: { heading: string; body: string[] }[]
  examples: { label: string; text: string }[]
  quiz: QuizQuestion[]
}

export const LESSON_XP = 20

export const THINKING_LESSONS: ThinkingLesson[] = [
  {
    id: "logic:lesson:deduction-induction",
    title: "Deduction vs induction",
    summary: "Certain conclusions vs likely ones.",
    minutes: 3,
    sections: [
      {
        heading: "Deduction: from rules to certainty",
        body: [
          "Deductive reasoning starts from general premises and reaches a conclusion that must be true if the premises are true.",
          "If the logic is valid and the premises are true, the conclusion is guaranteed. The weak point is always the premises.",
        ],
      },
      {
        heading: "Induction: from observations to probability",
        body: [
          "Inductive reasoning generalises from specific observations. The conclusion is likely, never certain.",
          "Most science and everyday learning is inductive — we see patterns and predict they'll continue. More (and more varied) evidence makes it stronger.",
        ],
      },
    ],
    examples: [
      { label: "Deduction", text: "All metals conduct electricity. Copper is a metal. So copper conducts electricity." },
      { label: "Induction", text: "Every swan I've seen is white, so all swans are probably white. (Black swans exist in Australia — induction can fail.)" },
    ],
    quiz: [
      {
        q: "“The bus has been late every Monday this month, so it'll probably be late next Monday.” Which kind of reasoning is this?",
        options: ["Deduction", "Induction", "Neither"],
        correct: 1,
        why: "It generalises from past observations to a likely prediction — induction.",
      },
      {
        q: "A deductive argument is valid and its premises are true. The conclusion is…",
        options: ["Probably true", "Guaranteed true", "Possibly false"],
        correct: 1,
        why: "That's the defining strength of deduction: valid form + true premises = certain conclusion.",
      },
      {
        q: "What makes an inductive conclusion stronger?",
        options: ["Using longer sentences", "More and more varied evidence", "Stating it confidently"],
        correct: 1,
        why: "Induction is only as good as its evidence; larger, more varied samples reduce the chance of being wrong.",
      },
    ],
  },
  {
    id: "logic:lesson:fallacies",
    title: "Common logical fallacies",
    summary: "Spot arguments that sound right but aren't.",
    minutes: 4,
    sections: [
      {
        heading: "What's a fallacy?",
        body: [
          "A fallacy is a flaw in reasoning that makes an argument weaker than it looks. Arguments can be persuasive and still fallacious.",
          "Naming the pattern helps you respond to the argument rather than to the person or the emotion.",
        ],
      },
      {
        heading: "Five to know",
        body: [
          "Ad hominem — attacking the person instead of their argument.",
          "Straw man — misrepresenting an argument to make it easier to knock down.",
          "False dilemma — presenting only two options when more exist.",
          "Slippery slope — claiming one step will inevitably lead to an extreme outcome without showing why.",
          "Appeal to popularity — “everyone believes it, so it must be true”.",
        ],
      },
    ],
    examples: [
      { label: "Ad hominem", text: "“Why listen to her views on the budget? She can't even keep her desk tidy.”" },
      { label: "False dilemma", text: "“Either we ban all cars from the city, or we accept terrible air forever.”" },
      { label: "Straw man", text: "A: “We should have fewer meetings.” B: “So you think nobody should ever talk to each other?”" },
    ],
    quiz: [
      {
        q: "“You're either with us or against us.” Which fallacy is this most likely?",
        options: ["Slippery slope", "False dilemma", "Ad hominem"],
        correct: 1,
        why: "It hides the many in-between positions — a false dilemma.",
      },
      {
        q: "“If we let students redo one test, soon nobody will ever study again.”",
        options: ["Slippery slope", "Straw man", "Appeal to popularity"],
        correct: 0,
        why: "It jumps from a small step to an extreme outcome without justification.",
      },
      {
        q: "“Millions of people use this remedy, so it must work.”",
        options: ["Ad hominem", "Appeal to popularity", "False dilemma"],
        correct: 1,
        why: "Popularity isn't evidence of effectiveness.",
      },
    ],
  },
  {
    id: "logic:lesson:correlation",
    title: "Correlation vs causation",
    summary: "Two things moving together doesn't mean one causes the other.",
    minutes: 3,
    sections: [
      {
        heading: "Correlation is a pattern",
        body: [
          "Two things are correlated when they tend to change together. That alone doesn't tell you why.",
          "Possible explanations: A causes B, B causes A, a third factor causes both, or it's coincidence.",
        ],
      },
      {
        heading: "Look for the hidden factor",
        body: [
          "Ice-cream sales and sunburns rise together — not because ice cream burns you, but because hot sunny weather drives both.",
          "Controlled experiments (changing one thing while keeping everything else the same) are the best way to show causation.",
        ],
      },
    ],
    examples: [
      { label: "Third factor", text: "Kids with bigger feet read better. Cause: older kids have bigger feet and have had more practice reading." },
      { label: "Reverse cause", text: "People who use walking sticks fall more often. The sticks don't cause falls — unsteady people use sticks." },
    ],
    quiz: [
      {
        q: "Cities with more firefighters have more fires. Best explanation?",
        options: ["Firefighters start fires", "Bigger cities have both more fires and more firefighters", "It's pure luck"],
        correct: 1,
        why: "City size is a third factor that drives both numbers.",
      },
      {
        q: "What's the strongest way to test whether A causes B?",
        options: ["Find a strong correlation", "Ask experts' opinions", "Run a controlled experiment changing only A"],
        correct: 2,
        why: "Changing only A while holding everything else constant isolates its effect on B.",
      },
      {
        q: "“Students who eat breakfast get better grades, so breakfast makes you smarter.” What's the flaw?",
        options: ["It assumes correlation implies causation", "It's a straw man", "Nothing — it's valid"],
        correct: 0,
        why: "Other factors (sleep, home routines) may explain both breakfast and grades.",
      },
    ],
  },
  {
    id: "logic:lesson:decompose",
    title: "Breaking problems down",
    summary: "Turn one hard problem into several easy ones.",
    minutes: 3,
    sections: [
      {
        heading: "Divide and conquer",
        body: [
          "Big problems feel impossible because you try to hold everything at once. Split them into smaller sub-problems you can solve one by one.",
          "Ask: what are the parts? Which part is the bottleneck? What do I already know?",
        ],
      },
      {
        heading: "Useful moves",
        body: [
          "Work backwards from the goal.",
          "Solve a simpler version first (smaller numbers, fewer people), then scale up.",
          "Write things down — a table, a list or a sketch frees up working memory.",
        ],
      },
    ],
    examples: [
      { label: "Planning a trip", text: "Split into: dates → budget → transport → accommodation → activities. Each step narrows the next." },
      { label: "Simpler version", text: "How many handshakes among 20 people? Try 2, 3, 4 people first: 1, 3, 6… the pattern is n(n−1)/2 → 190." },
    ],
    quiz: [
      {
        q: "You're stuck on a puzzle with 50 items. A good first move is…",
        options: ["Guess and move on", "Try the same puzzle with 3 items to find the pattern", "Start over from scratch"],
        correct: 1,
        why: "Solving a smaller version often reveals the rule that scales.",
      },
      {
        q: "Working backwards is most useful when…",
        options: ["The end state is known but the start is unclear", "There is no goal", "The problem is already solved"],
        correct: 0,
        why: "If you know where you need to end up, stepping backwards often shows the path.",
      },
      {
        q: "Why write sub-problems down?",
        options: ["It looks organised", "It frees working memory to focus on one part", "It's required by logic"],
        correct: 1,
        why: "Our working memory is small — offloading details lets you think clearly about each piece.",
      },
    ],
  },
  {
    id: "logic:lesson:fermi",
    title: "Estimating (Fermi questions)",
    summary: "Get a sensible answer with rough numbers.",
    minutes: 4,
    sections: [
      {
        heading: "Rough is often good enough",
        body: [
          "Fermi questions ask for an estimate when you can't look up the answer: “How many piano tuners are in a city of 1 million?”",
          "Break the question into factors you can guess, multiply them, and round. Errors in different factors often cancel out.",
        ],
      },
      {
        heading: "The method",
        body: [
          "1. Write the chain of factors that leads to the answer.",
          "2. Estimate each one with round numbers (powers of ten are fine).",
          "3. Multiply and sanity-check: is the result in a believable range?",
        ],
      },
    ],
    examples: [
      {
        label: "Piano tuners",
        text: "1,000,000 people ÷ 2.5 per home = 400,000 homes; 1 in 20 has a piano → 20,000 pianos; tuned once a year; a tuner does ~1,000 tunings a year → about 20 tuners.",
      },
      { label: "Heartbeats", text: "~70 beats/min × 60 × 24 × 365 ≈ 37 million a year; × 80 years ≈ 3 billion in a lifetime." },
    ],
    quiz: [
      {
        q: "What's the first step in a Fermi estimate?",
        options: ["Search online", "Break the question into factors you can estimate", "Pick a random number"],
        correct: 1,
        why: "Decomposing into estimable factors is the core of the method.",
      },
      {
        q: "Roughly how many seconds are in a day?",
        options: ["About 9,000", "About 90,000", "About 900,000"],
        correct: 1,
        why: "24 × 60 × 60 = 86,400 — about 90,000.",
      },
      {
        q: "Why do Fermi estimates often land close to the truth?",
        options: ["Over- and under-estimates in different factors tend to cancel", "Because they use exact data", "They don't — they're always wrong"],
        correct: 0,
        why: "Independent errors partly cancel when multiplied, so the overall estimate is usually within a factor of a few.",
      },
    ],
  },
  {
    id: "logic:lesson:assumptions",
    title: "Checking assumptions",
    summary: "The hidden beliefs that steer your reasoning.",
    minutes: 3,
    sections: [
      {
        heading: "Every argument rests on something unsaid",
        body: [
          "An assumption is a belief you treat as true without checking. Many puzzles (and real mistakes) work by exploiting them.",
          "When a problem seems impossible, list what you're assuming — one of those assumptions is often the trap.",
        ],
      },
      {
        heading: "Questions to ask",
        body: [
          "What would have to be true for this to work?",
          "Is there another interpretation of the words?",
          "What evidence do I actually have, versus what am I filling in?",
        ],
      },
    ],
    examples: [
      { label: "Riddle trap", text: "“A doctor's son was in an accident; the doctor said ‘I can't operate, he's my son’ — but the doctor isn't his father.” The doctor is his mother." },
      { label: "Workplace", text: "“Sales fell after the redesign, so the redesign hurt sales” assumes nothing else changed — maybe it was a holiday month." },
    ],
    quiz: [
      {
        q: "“Our new app has few complaints, so users love it.” What's assumed?",
        options: ["That unhappy users would complain", "That the app is new", "Nothing"],
        correct: 0,
        why: "Many unhappy users just leave silently — few complaints doesn't mean love.",
      },
      {
        q: "A puzzle seems impossible. A helpful step is to…",
        options: ["List the assumptions you're making", "Give up", "Read it faster"],
        correct: 0,
        why: "Impossible-seeming puzzles usually hinge on an assumption you didn't notice.",
      },
      {
        q: "“Connect 9 dots in a 3×3 grid with 4 straight lines without lifting your pen.” What's the usual hidden assumption?",
        options: ["Lines must be straight", "Lines must stay inside the square of dots", "You must use a pen"],
        correct: 1,
        why: "The solution extends lines beyond the grid — that's where “think outside the box” comes from.",
      },
    ],
  },
  {
    id: "logic:lesson:base-rates",
    title: "Thinking in base rates",
    summary: "Start from how common something is.",
    minutes: 4,
    sections: [
      {
        heading: "Don't ignore how common things are",
        body: [
          "The base rate is how often something happens in general. Vivid details tempt us to ignore it.",
          "Before judging a specific case, ask: out of 100 similar cases, how many usually turn out this way?",
        ],
      },
      {
        heading: "Rare things stay rare",
        body: [
          "A test that's 99% accurate for a disease that affects 1 in 10,000 people will flag far more healthy people than sick ones.",
          "Picture actual counts (out of 10,000 people…) rather than percentages — it makes the answer much clearer.",
        ],
      },
    ],
    examples: [
      { label: "Librarian or farmer?", text: "A quiet, tidy person who loves books is more likely a farmer than a librarian — simply because there are far more farmers." },
      { label: "Counts not percents", text: "10,000 people, 1 sick. A 99%-accurate test flags ~100 healthy people plus the 1 sick one — a positive result is still probably a false alarm." },
    ],
    quiz: [
      {
        q: "What is a base rate?",
        options: ["How fast something happens", "How common something is in general", "The lowest possible score"],
        correct: 1,
        why: "A base rate is the general frequency, before considering specific details.",
      },
      {
        q: "A test for a very rare condition comes back positive. You should…",
        options: ["Assume you definitely have it", "Remember most positives may be false alarms when the condition is rare", "Ignore the result"],
        correct: 1,
        why: "With a low base rate, false positives can outnumber true positives.",
      },
      {
        q: "Which trick makes base-rate problems easier?",
        options: ["Using percentages only", "Imagining concrete counts, e.g. out of 1,000 people", "Rounding everything to zero"],
        correct: 1,
        why: "Natural frequencies (counts) make the numbers intuitive.",
      },
    ],
  },
]

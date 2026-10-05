import type { FunLanguage, FunQuestion, FunQuestionText } from "@/types"

/**
 * Built-in bilingual starter questions, so Learn with Fun works offline and
 * without a Gemini key. AI quizzes add unlimited fresh questions on top.
 */

interface StarterText extends FunQuestionText {
  hint: string
}

interface StarterQuestion {
  answerIndex: number
  en: StarterText
  hi: StarterText
}

const STARTER: Record<string, StarterQuestion[]> = {
  logical: [
    {
      answerIndex: 1,
      en: {
        question: "Complete the series: 2, 6, 12, 20, 30, ?",
        options: ["40", "42", "44", "36"],
        hint: "Look at the gap between each pair of numbers.",
        explanation: "The gaps grow by 2 each time: +4, +6, +8, +10, so the next gap is +12 → 30 + 12 = 42.",
      },
      hi: {
        question: "श्रृंखला पूरी करें: 2, 6, 12, 20, 30, ?",
        options: ["40", "42", "44", "36"],
        hint: "हर दो संख्याओं के बीच का अंतर देखें।",
        explanation: "अंतर हर बार 2 बढ़ता है: +4, +6, +8, +10, इसलिए अगला अंतर +12 → 30 + 12 = 42।",
      },
    },
    {
      answerIndex: 2,
      en: {
        question: "Which one is the odd one out?",
        options: ["Apple", "Mango", "Potato", "Banana"],
        hint: "Think about where each one grows and how we eat it.",
        explanation: "Apple, mango and banana are fruits. Potato is a vegetable (it grows under the ground).",
      },
      hi: {
        question: "इनमें से कौन बेमेल है?",
        options: ["सेब", "आम", "आलू", "केला"],
        hint: "सोचिए, कौन फल है और कौन नहीं।",
        explanation: "सेब, आम और केला फल हैं। आलू एक सब्ज़ी है (यह ज़मीन के नीचे उगता है)।",
      },
    },
    {
      answerIndex: 0,
      en: {
        question: "If CAT is written as DBU, how is DOG written in the same code?",
        options: ["EPH", "CNF", "EOH", "DPH"],
        hint: "Compare each letter of CAT with DBU.",
        explanation: "Each letter moves one step forward: C→D, A→B, T→U. So D→E, O→P, G→H gives EPH.",
      },
      hi: {
        question: "यदि CAT को DBU लिखा जाता है, तो इसी कोड में DOG को कैसे लिखेंगे?",
        options: ["EPH", "CNF", "EOH", "DPH"],
        hint: "CAT के हर अक्षर की तुलना DBU से करें।",
        explanation: "हर अक्षर एक कदम आगे बढ़ता है: C→D, A→B, T→U। इसलिए D→E, O→P, G→H = EPH।",
      },
    },
  ],
  reasoning: [
    {
      answerIndex: 2,
      en: {
        question: "Ravi walks 5 km north, turns right and walks 3 km, then turns right again and walks 5 km. In which direction is he from his starting point?",
        options: ["North", "South", "East", "West"],
        hint: "Draw it: a right turn from north faces east.",
        explanation: "North 5 km, right → east 3 km, right → south 5 km. The north and south cancel out, so he is 3 km east of the start.",
      },
      hi: {
        question: "रवि 5 किमी उत्तर चलता है, दाएँ मुड़कर 3 किमी चलता है, फिर दोबारा दाएँ मुड़कर 5 किमी चलता है। वह अपने शुरुआती स्थान से किस दिशा में है?",
        options: ["उत्तर", "दक्षिण", "पूर्व", "पश्चिम"],
        hint: "चित्र बनाइए: उत्तर से दाएँ मुड़ने पर पूर्व आता है।",
        explanation: "उत्तर 5 किमी, दाएँ → पूर्व 3 किमी, दाएँ → दक्षिण 5 किमी। उत्तर और दक्षिण बराबर हो गए, इसलिए वह शुरुआत से 3 किमी पूर्व में है।",
      },
    },
    {
      answerIndex: 1,
      en: {
        question: "Pointing to a boy, Sita says, “He is the son of my mother's only son.” How is the boy related to Sita?",
        options: ["Brother", "Nephew", "Cousin", "Son"],
        hint: "Who is the only son of Sita's mother?",
        explanation: "Sita's mother's only son is Sita's brother. The son of her brother is her nephew.",
      },
      hi: {
        question: "एक लड़के की ओर इशारा करते हुए सीता कहती है, “यह मेरी माँ के इकलौते बेटे का बेटा है।” लड़का सीता का क्या लगता है?",
        options: ["भाई", "भतीजा", "चचेरा भाई", "बेटा"],
        hint: "सीता की माँ का इकलौता बेटा कौन है?",
        explanation: "सीता की माँ का इकलौता बेटा सीता का भाई है। भाई का बेटा सीता का भतीजा हुआ।",
      },
    },
    {
      answerIndex: 1,
      en: {
        question: "If today is Monday, what day will it be after 10 days?",
        options: ["Wednesday", "Thursday", "Friday", "Sunday"],
        hint: "A week has 7 days, so remove full weeks first.",
        explanation: "10 days = 1 week + 3 days. Monday + 3 days = Thursday.",
      },
      hi: {
        question: "यदि आज सोमवार है, तो 10 दिन बाद कौन-सा दिन होगा?",
        options: ["बुधवार", "गुरुवार", "शुक्रवार", "रविवार"],
        hint: "एक सप्ताह में 7 दिन होते हैं, पहले पूरे सप्ताह हटाइए।",
        explanation: "10 दिन = 1 सप्ताह + 3 दिन। सोमवार + 3 दिन = गुरुवार।",
      },
    },
  ],
  english: [
    {
      answerIndex: 1,
      en: {
        question: "Choose the synonym (same meaning) of “Happy”.",
        options: ["Sad", "Joyful", "Angry", "Tired"],
        hint: "Which word describes a big smile?",
        explanation: "“Joyful” means full of happiness, so it is a synonym of “happy”. “Sad” is its opposite (antonym).",
      },
      hi: {
        question: "“Happy” का समानार्थी (synonym) शब्द चुनें।",
        options: ["Sad", "Joyful", "Angry", "Tired"],
        hint: "कौन-सा शब्द बड़ी मुस्कान जैसा लगता है?",
        explanation: "“Joyful” का अर्थ है खुशी से भरा हुआ, इसलिए यह “happy” का समानार्थी है। “Sad” इसका विलोम है।",
      },
    },
    {
      answerIndex: 1,
      en: {
        question: "Fill in the blank: She ___ to school every day.",
        options: ["go", "goes", "going", "gone"],
        hint: "The subject is “she” and it happens every day.",
        explanation: "For habits we use the simple present. With he/she/it we add -s or -es: “She goes to school every day.”",
      },
      hi: {
        question: "रिक्त स्थान भरें: She ___ to school every day.",
        options: ["go", "goes", "going", "gone"],
        hint: "कर्ता “she” है और काम रोज़ होता है।",
        explanation: "रोज़ की आदत के लिए Simple Present लगता है। he/she/it के साथ क्रिया में -s या -es जुड़ता है: “She goes to school every day.”",
      },
    },
    {
      answerIndex: 0,
      en: {
        question: "One word for “a person who writes poems”:",
        options: ["Poet", "Author", "Painter", "Singer"],
        hint: "Poems → ?",
        explanation: "A poet writes poems. An author writes books in general, a painter paints and a singer sings.",
      },
      hi: {
        question: "“a person who writes poems” के लिए एक शब्द चुनें:",
        options: ["Poet", "Author", "Painter", "Singer"],
        hint: "Poems (कविताएँ) → ?",
        explanation: "Poet (कवि) कविताएँ लिखता है। Author आम तौर पर किताबें लिखता है, Painter चित्र बनाता है और Singer गाता है।",
      },
    },
  ],
  riddles: [
    {
      answerIndex: 1,
      en: {
        question: "I have keys but I can't open any lock. What am I?",
        options: ["A map", "A piano", "A door", "A tree"],
        hint: "You can make music with my keys.",
        explanation: "A piano has keys (black and white) that play music, but they can't open locks!",
      },
      hi: {
        question: "मेरे पास बहुत-सी चाबियाँ (keys) हैं, पर मैं कोई ताला नहीं खोल सकता। मैं कौन हूँ?",
        options: ["नक्शा", "पियानो", "दरवाज़ा", "पेड़"],
        hint: "मेरी keys दबाने से संगीत बजता है।",
        explanation: "पियानो में काली-सफ़ेद keys होती हैं जिनसे संगीत बजता है, पर उनसे ताला नहीं खुलता!",
      },
    },
    {
      answerIndex: 0,
      en: {
        question: "The more you take, the more you leave behind. What am I?",
        options: ["Footsteps", "Money", "Time", "Food"],
        hint: "Think about walking on sand.",
        explanation: "Every step you take leaves a footprint behind you — the more steps, the more footprints.",
      },
      hi: {
        question: "तुम जितना ज़्यादा मुझे उठाओगे, उतना ही ज़्यादा पीछे छोड़ते जाओगे। मैं क्या हूँ?",
        options: ["कदम (पैरों के निशान)", "पैसा", "समय", "खाना"],
        hint: "रेत पर चलने के बारे में सोचिए।",
        explanation: "हर कदम उठाने पर पीछे एक निशान छूट जाता है — जितने ज़्यादा कदम, उतने ज़्यादा निशान।",
      },
    },
    {
      answerIndex: 0,
      en: {
        question: "A classic Hindi riddle: “A plate full of pearls, turned upside down over everyone's head.” What is it?",
        options: ["The night sky with stars", "An umbrella", "A roof", "A tree"],
        hint: "You see the pearls only at night.",
        explanation: "The sky is like an upside-down plate over everyone, and the stars are its shining pearls.",
      },
      hi: {
        question: "पहेली: “एक थाल मोतियों से भरा, सबके सिर पर औंधा धरा।” बताओ क्या?",
        options: ["तारों भरा आसमान", "छाता", "छत", "पेड़"],
        hint: "ये मोती सिर्फ़ रात में दिखते हैं।",
        explanation: "आसमान सबके सिर पर उल्टे थाल जैसा है और तारे उसमें चमकते मोती हैं।",
      },
    },
  ],
  idioms: [
    {
      answerIndex: 0,
      en: {
        question: "What does the idiom “a piece of cake” mean?",
        options: ["Something very easy", "A sweet dish", "A small share", "A celebration"],
        hint: "“The test was a piece of cake!” — was it hard?",
        explanation: "“A piece of cake” means something very easy to do, e.g. “The maths test was a piece of cake.”",
      },
      hi: {
        question: "अंग्रेज़ी मुहावरे “a piece of cake” का अर्थ क्या है?",
        options: ["बहुत आसान काम", "एक मीठा पकवान", "छोटा हिस्सा", "जश्न"],
        hint: "“The test was a piece of cake!” — क्या परीक्षा कठिन थी?",
        explanation: "“A piece of cake” का अर्थ है बहुत आसान काम, जैसे “The maths test was a piece of cake.”",
      },
    },
    {
      answerIndex: 0,
      en: {
        question: "What does the Hindi idiom “नौ दो ग्यारह होना” (nau do gyarah hona) mean?",
        options: ["To run away quickly", "To count numbers", "To become rich", "To start a fight"],
        hint: "The thief saw the police and…",
        explanation: "It means to run away or vanish quickly, e.g. “Police ko dekhte hi chor nau do gyarah ho gaya.”",
      },
      hi: {
        question: "मुहावरे “नौ दो ग्यारह होना” का अर्थ क्या है?",
        options: ["भाग जाना", "गिनती करना", "अमीर बनना", "झगड़ा शुरू करना"],
        hint: "पुलिस को देखते ही चोर…",
        explanation: "इसका अर्थ है तेज़ी से भाग जाना, जैसे “पुलिस को देखते ही चोर नौ दो ग्यारह हो गया।”",
      },
    },
    {
      answerIndex: 2,
      en: {
        question: "“Let's play a game to break the ice.” What does “break the ice” mean here?",
        options: ["Break something frozen", "Win easily", "Help people feel relaxed and start talking", "Get angry"],
        hint: "It's used when people meet for the first time.",
        explanation: "To “break the ice” means to make people feel comfortable and start a conversation in an awkward or new situation.",
      },
      hi: {
        question: "“Let's play a game to break the ice.” यहाँ “break the ice” का क्या अर्थ है?",
        options: ["जमी हुई चीज़ तोड़ना", "आसानी से जीतना", "झिझक दूर करके बातचीत शुरू करना", "गुस्सा होना"],
        hint: "यह तब कहते हैं जब लोग पहली बार मिलते हैं।",
        explanation: "“Break the ice” का अर्थ है नई या अजीब स्थिति में झिझक दूर करके बातचीत शुरू करना।",
      },
    },
  ],
  story: [
    {
      answerIndex: 0,
      en: {
        story:
          "On a hot summer day, a thirsty crow found a pot with a little water at the bottom. His beak could not reach it. He looked around, picked up small pebbles and dropped them into the pot one by one. Slowly the water rose, and the crow drank happily.",
        question: "What is the moral of the story?",
        options: ["Where there's a will, there's a way", "Never trust strangers", "Slow and steady wins the race", "Greed is bad"],
        hint: "The crow didn't give up — he found a clever way.",
        explanation: "The crow kept trying and used his brain to solve the problem: where there's a will, there's a way.",
      },
      hi: {
        story:
          "गर्मी के एक दिन एक प्यासे कौए को एक घड़ा मिला जिसमें तली पर थोड़ा-सा पानी था। उसकी चोंच पानी तक नहीं पहुँच रही थी। उसने आस-पास से छोटे कंकड़ उठाए और एक-एक करके घड़े में डाले। धीरे-धीरे पानी ऊपर आ गया और कौए ने खुशी से पानी पिया।",
        question: "इस कहानी की सीख क्या है?",
        options: ["जहाँ चाह, वहाँ राह", "अजनबियों पर कभी भरोसा मत करो", "धीरे-धीरे चलने वाला जीतता है", "लालच बुरी बला है"],
        hint: "कौए ने हार नहीं मानी — उसने चतुर तरीका खोजा।",
        explanation: "कौए ने कोशिश जारी रखी और दिमाग़ लगाकर समस्या हल की: जहाँ चाह, वहाँ राह।",
      },
    },
    {
      answerIndex: 0,
      en: {
        story:
          "One day Emperor Akbar drew a line on the floor and said to his courtiers, “Make this line shorter without erasing or touching any part of it.” Everyone was puzzled. Then Birbal stepped forward, picked up the chalk and smiled.",
        question: "How did Birbal make Akbar's line shorter?",
        options: ["He drew a longer line next to it", "He erased half of it", "He covered part of it with a cloth", "He folded the floor mat"],
        hint: "“Short” compared to what?",
        explanation: "Birbal drew a longer line beside it. Without touching it, Akbar's line now looked shorter — things are big or small only in comparison.",
      },
      hi: {
        story:
          "एक दिन बादशाह अकबर ने ज़मीन पर एक लकीर खींची और दरबारियों से कहा, “इस लकीर को बिना मिटाए और बिना छुए छोटा करके दिखाओ।” सब हैरान थे। तभी बीरबल आगे आए, चॉक उठाई और मुस्कुराए।",
        question: "बीरबल ने अकबर की लकीर को छोटा कैसे किया?",
        options: ["उसके पास एक लंबी लकीर खींचकर", "आधी लकीर मिटाकर", "कपड़े से एक हिस्सा ढककर", "चटाई मोड़कर"],
        hint: "“छोटी” — किसकी तुलना में?",
        explanation: "बीरबल ने पास में एक लंबी लकीर खींच दी। बिना छुए अकबर की लकीर अब छोटी दिखने लगी — कोई चीज़ तुलना से ही बड़ी या छोटी होती है।",
      },
    },
    {
      answerIndex: 0,
      en: {
        story:
          "Meera looked out of the window. Dark clouds were gathering, a cool wind was blowing, ants were hurrying into their hole carrying food, and her grandmother rushed to bring the clothes in from the line.",
        question: "What is most likely to happen next?",
        options: ["It will rain", "It will snow", "There will be an earthquake", "A festival will begin"],
        hint: "Look at the clouds and what everyone is doing.",
        explanation: "Dark clouds, cool wind, ants storing food and clothes being brought in are all signs that rain is coming.",
      },
      hi: {
        story:
          "मीरा ने खिड़की से बाहर देखा। काले बादल घिर रहे थे, ठंडी हवा चल रही थी, चींटियाँ खाना लेकर जल्दी-जल्दी अपने बिल में जा रही थीं और दादी रस्सी से कपड़े उतारने दौड़ीं।",
        question: "आगे सबसे ज़्यादा क्या होने की संभावना है?",
        options: ["बारिश होगी", "बर्फ़ गिरेगी", "भूकंप आएगा", "त्योहार शुरू होगा"],
        hint: "बादलों और सबकी हरकतों पर ध्यान दें।",
        explanation: "काले बादल, ठंडी हवा, चींटियों का खाना जमा करना और कपड़े उतारना — ये सब बारिश आने के संकेत हैं।",
      },
    },
  ],
  gk: [
    {
      answerIndex: 1,
      en: {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        hint: "India's Mangalyaan went there.",
        explanation: "Mars looks red because of iron oxide (rust) in its soil. India's Mangalyaan mission reached Mars in 2014.",
      },
      hi: {
        question: "किस ग्रह को “लाल ग्रह” कहा जाता है?",
        options: ["शुक्र", "मंगल", "बृहस्पति", "शनि"],
        hint: "भारत का मंगलयान वहाँ गया था।",
        explanation: "मंगल की मिट्टी में आयरन ऑक्साइड (जंग) होने से वह लाल दिखता है। भारत का मंगलयान 2014 में मंगल पर पहुँचा।",
      },
    },
    {
      answerIndex: 2,
      en: {
        question: "What is the national animal of India?",
        options: ["Lion", "Elephant", "Bengal tiger", "Peacock"],
        hint: "It has orange fur with black stripes.",
        explanation: "The Bengal tiger is India's national animal. The peacock is the national bird.",
      },
      hi: {
        question: "भारत का राष्ट्रीय पशु कौन-सा है?",
        options: ["शेर", "हाथी", "बाघ (बंगाल टाइगर)", "मोर"],
        hint: "इसकी नारंगी खाल पर काली धारियाँ होती हैं।",
        explanation: "बाघ (बंगाल टाइगर) भारत का राष्ट्रीय पशु है। मोर राष्ट्रीय पक्षी है।",
      },
    },
    {
      answerIndex: 1,
      en: {
        question: "How many days are there in a leap year?",
        options: ["365", "366", "364", "360"],
        hint: "February gets one extra day.",
        explanation: "A leap year has 366 days because February has 29 days instead of 28.",
      },
      hi: {
        question: "लीप वर्ष में कितने दिन होते हैं?",
        options: ["365", "366", "364", "360"],
        hint: "फ़रवरी में एक दिन ज़्यादा होता है।",
        explanation: "लीप वर्ष में 366 दिन होते हैं क्योंकि फ़रवरी में 28 की जगह 29 दिन होते हैं।",
      },
    },
  ],
  maths: [
    {
      answerIndex: 1,
      en: {
        question: "What is 25% of 80?",
        options: ["15", "20", "25", "30"],
        hint: "25% is the same as one quarter.",
        explanation: "25% = 1/4, and 80 ÷ 4 = 20.",
      },
      hi: {
        question: "80 का 25% कितना है?",
        options: ["15", "20", "25", "30"],
        hint: "25% का मतलब है एक-चौथाई।",
        explanation: "25% = 1/4, और 80 ÷ 4 = 20।",
      },
    },
    {
      answerIndex: 2,
      en: {
        question: "A train travels 60 km in 1 hour. How far will it travel in 2½ hours at the same speed?",
        options: ["120 km", "140 km", "150 km", "180 km"],
        hint: "Distance = speed × time.",
        explanation: "60 km/h × 2.5 h = 150 km.",
      },
      hi: {
        question: "एक ट्रेन 1 घंटे में 60 किमी चलती है। उसी चाल से 2½ घंटे में कितनी दूरी तय करेगी?",
        options: ["120 किमी", "140 किमी", "150 किमी", "180 किमी"],
        hint: "दूरी = चाल × समय।",
        explanation: "60 किमी/घंटा × 2.5 घंटे = 150 किमी।",
      },
    },
    {
      answerIndex: 2,
      en: {
        question: "7 pencils cost ₹35. How much will 12 pencils cost?",
        options: ["₹50", "₹55", "₹60", "₹70"],
        hint: "First find the price of one pencil.",
        explanation: "One pencil = ₹35 ÷ 7 = ₹5. So 12 pencils = 12 × ₹5 = ₹60.",
      },
      hi: {
        question: "7 पेंसिलों की कीमत ₹35 है। 12 पेंसिलों की कीमत कितनी होगी?",
        options: ["₹50", "₹55", "₹60", "₹70"],
        hint: "पहले एक पेंसिल की कीमत निकालिए।",
        explanation: "एक पेंसिल = ₹35 ÷ 7 = ₹5। इसलिए 12 पेंसिल = 12 × ₹5 = ₹60।",
      },
    },
  ],
}

const toText = (t: StarterText): FunQuestionText => ({ story: t.story, question: t.question, options: t.options, explanation: t.explanation })

function pick(q: StarterQuestion, language: FunLanguage): FunQuestion {
  const main = language === "hi" ? q.hi : q.en
  return { ...toText(main), hint: main.hint, answerIndex: q.answerIndex, hindi: undefined }
}

/** Starter questions for a category (or all categories mixed). */
export function starterQuestions(category: string | "all", language: FunLanguage): FunQuestion[] {
  const pool = category === "all" || !STARTER[category] ? Object.values(STARTER).flat() : STARTER[category]
  return pool.map((q) => pick(q, language))
}

export const hasStarter = (category: string) => !!STARTER[category]

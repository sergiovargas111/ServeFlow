import { rng, shuffle } from "./random";

// Practice drill content. Kept in code (versioned, reviewed in PRs) rather
// than the database; only attempts are stored per user. Stay general: no
// legal claims (alcohol service and allergen rules vary by state and house
// policy, so questions point to "your house policy" instead of a rule).

export interface Question {
  prompt: string;
  choices: readonly string[];
  /** Index into choices. */
  answer: number;
  why: string;
}

export interface Drill {
  id: string;
  level: LevelId;
  title: string;
  summary: string;
  questions: readonly Question[];
}

export const LEVELS = [
  { id: 1, title: "Basics", summary: "Greeting, steps of service, allergens and guest problems." },
  { id: 2, title: "Upselling", summary: "Suggest, don't push: apps, drinks, desserts and reading the table." },
  { id: 3, title: "Wine & Cocktails", summary: "Coming later." },
  { id: 4, title: "Section Management", summary: "Coming later." },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

/** Levels with drills today. 3 and 4 are shown as coming later. */
export const PLAYABLE_LEVELS: readonly LevelId[] = [1, 2];

/** A drill counts as passed at 80% or better. */
export const PASS_RATIO = 0.8;

/** Authored with the right answer anywhere; choices are shuffled below. */
const AUTHORED: readonly Drill[] = [
  {
    id: "l1-greeting",
    level: 1,
    title: "First impressions",
    summary: "The greet sets the tone for the whole table.",
    questions: [
      {
        prompt: "A table was just sat in your section and you're busy. What's the best first move?",
        choices: [
          "Wait until you're free, then greet them properly",
          "Stop by within a minute to say hi and that you'll be right back",
          "Ask another server to take the table",
          "Drop menus and walk away without speaking",
        ],
        answer: 1,
        why: "A quick acknowledgment tells guests they've been seen, even if the full greet comes a minute later.",
      },
      {
        prompt: "Which greeting gives the table something useful right away?",
        choices: [
          "\"Hi, what do you want?\"",
          "\"Hi, I'm Sam. Can I start you with drinks? Our house lemonade is fresh today.\"",
          "\"Are you ready to order?\"",
          "\"Hey guys.\"",
        ],
        answer: 1,
        why: "Your name, a clear next step and one specific suggestion make ordering easy.",
      },
      {
        prompt: "A guest seems rushed and keeps checking their watch. What helps most?",
        choices: [
          "Describe every special in detail",
          "Ask if they're on a schedule and suggest dishes that come out quickly",
          "Leave them alone until they wave you down",
          "Tell them the kitchen is slow tonight",
        ],
        answer: 1,
        why: "Asking about their time lets you plan around it instead of guessing.",
      },
      {
        prompt: "When should you mention the specials?",
        choices: [
          "Only if a guest asks",
          "After the entrée order is placed",
          "Early, before guests decide, while they're still looking at the menu",
          "When dropping the check",
        ],
        answer: 2,
        why: "Specials only sell if guests hear them before they've made up their minds.",
      },
      {
        prompt: "What's a good way to remember who ordered what at a big table?",
        choices: [
          "Trust your memory",
          "Use seat numbers, starting from a fixed point at the table",
          "Ask each guest again when the food arrives",
          "Let the runner figure it out",
        ],
        answer: 1,
        why: "Seat numbers from a fixed starting point let anyone run the food without auctioning plates.",
      },
    ],
  },
  {
    id: "l1-steps",
    level: 1,
    title: "Steps of service",
    summary: "The rhythm of a table from greet to goodbye.",
    questions: [
      {
        prompt: "About how soon after food is dropped should you check back?",
        choices: ["Right away, before the first bite", "Within two bites or about two minutes", "After 15 minutes", "Only when plates are empty"],
        answer: 1,
        why: "Two bites in, guests know if something is wrong and there's still time to fix it.",
      },
      {
        prompt: "A guest's glass is a third full. What do you do?",
        choices: ["Nothing until it's empty", "Offer a refill or another round", "Take the glass away", "Bring the check"],
        answer: 1,
        why: "Offering before it's empty keeps the table happy and is a natural moment to sell another drink.",
      },
      {
        prompt: "When is the usual time to clear plates?",
        choices: [
          "As soon as anyone finishes",
          "When most of the table has finished, unless a guest asks sooner",
          "Only after the check is paid",
          "Never; the busser does it",
        ],
        answer: 1,
        why: "Clearing while others are still eating can make them feel rushed.",
      },
      {
        prompt: "What's the best time to drop the check?",
        choices: [
          "With the entrées",
          "When the table asks for it or clearly signals they're done, after offering dessert or coffee",
          "As soon as plates are cleared, without asking",
          "Whenever you need the table back",
        ],
        answer: 1,
        why: "Offer the last course first; dropping the check too early can feel like being rushed out.",
      },
      {
        prompt: "You're in the weeds with four tables needing you. What comes first?",
        choices: [
          "The table that's been waiting longest for anything at all",
          "The table with the biggest bill",
          "Whoever is loudest",
          "Your side work",
        ],
        answer: 0,
        why: "Triage by wait: a quick 'I'll be right with you' to a new table beats a guest who's been ignored for ten minutes.",
      },
    ],
  },
  {
    id: "l1-allergens",
    level: 1,
    title: "Allergen basics",
    summary: "Take every allergy seriously and loop in the kitchen.",
    questions: [
      {
        prompt: "Which of these is one of the nine major food allergens in the US?",
        choices: ["Sesame", "Garlic", "Rice", "Corn"],
        answer: 0,
        why: "The nine major US food allergens are milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans and sesame.",
      },
      {
        prompt: "A guest says they have a severe nut allergy. What do you do?",
        choices: [
          "Tell them which dishes look nut-free",
          "Note it on the ticket and check with the kitchen or manager before recommending anything",
          "Suggest they order something plain",
          "Say everything is fine as long as they avoid desserts",
        ],
        answer: 1,
        why: "Only the kitchen knows every ingredient and how food is prepped; always confirm with them.",
      },
      {
        prompt: "What is cross-contact?",
        choices: [
          "When two guests share a dish",
          "When an allergen gets into food that doesn't contain it, like on a shared fryer or cutting board",
          "When a server touches two tables",
          "When a dish is sent back",
        ],
        answer: 1,
        why: "A dish can be free of an ingredient and still unsafe if it shares oil, surfaces or utensils.",
      },
      {
        prompt: "A guest says gluten 'makes them feel bad' but it's not celiac. How should you treat the order?",
        choices: [
          "Ignore it; it's a preference",
          "Pass it to the kitchen the same way you would any allergy and let them guide you",
          "Roll your eyes and ring it in",
          "Tell them gluten is harmless",
        ],
        answer: 1,
        why: "You can't judge how sensitive someone is. Treat it seriously and let the kitchen decide what's safe.",
      },
      {
        prompt: "The kitchen isn't sure whether a sauce has dairy. What do you tell the guest?",
        choices: [
          "\"It's probably fine.\"",
          "\"We can't confirm it's dairy-free, so I'd steer you to a dish we can confirm.\"",
          "\"Just scrape the sauce off.\"",
          "Say nothing",
        ],
        answer: 1,
        why: "If you can't confirm it, say so. A guess about an allergen is never okay.",
      },
    ],
  },
  {
    id: "l1-recovery",
    level: 1,
    title: "Handling guest problems",
    summary: "Turn a complaint into a guest who comes back.",
    questions: [
      {
        prompt: "A guest says their steak is overcooked. What's the first thing to say?",
        choices: [
          "\"That's how the kitchen cooks it.\"",
          "\"I'm sorry about that. Let me get you one cooked the way you like.\"",
          "\"Are you sure?\"",
          "\"Most people like it that way.\"",
        ],
        answer: 1,
        why: "Apologize, own it and offer the fix. No arguing about whose fault it was.",
      },
      {
        prompt: "A guest is getting louder and rude with you. What's a good move?",
        choices: [
          "Match their tone",
          "Stay calm, keep it short and bring in a manager if it continues",
          "Ignore the table for the rest of the night",
          "Tell other tables about it",
        ],
        answer: 1,
        why: "You don't have to absorb abuse. Stay calm and get a manager involved early.",
      },
      {
        prompt: "When should you get a manager for a complaint?",
        choices: [
          "Never; handle everything yourself",
          "When a guest asks, when you can't fix it yourself, or when a comp might be needed",
          "Only if the guest threatens a bad review",
          "Only at the end of the night",
        ],
        answer: 1,
        why: "Managers can comp, re-fire and smooth things over in ways you may not be allowed to.",
      },
      {
        prompt: "The kitchen is backed up and food is running late. What do you tell the table?",
        choices: [
          "Nothing, and hope they don't notice",
          "A quick, honest update with a time estimate, before they have to ask",
          "Blame the cooks",
          "Say it's coming out now when it isn't",
        ],
        answer: 1,
        why: "Guests mind waiting less when they know what's going on.",
      },
      {
        prompt: "A guest leaves happy after a mistake was fixed. What helps the most next time they come in?",
        choices: [
          "Pretending it never happened",
          "Remembering them and making sure it goes right",
          "Avoiding their table",
          "Reminding them of the mistake",
        ],
        answer: 1,
        why: "A fixed mistake plus a great next visit is how regulars are made.",
      },
    ],
  },
  {
    id: "l2-suggestive",
    level: 2,
    title: "Suggestive selling",
    summary: "Specific, honest suggestions beat yes/no questions.",
    questions: [
      {
        prompt: "Which line sells better?",
        choices: [
          "\"Do you want an appetizer?\"",
          "\"The crispy calamari is great to share while you decide.\"",
          "\"Appetizers?\"",
          "\"You probably don't want an appetizer, right?\"",
        ],
        answer: 1,
        why: "A specific, described item is easier to say yes to than a yes/no question.",
      },
      {
        prompt: "A guest asks what you'd recommend. What's the best answer?",
        choices: [
          "\"Everything's good.\"",
          "Ask what they're in the mood for, then give one or two specific favorites and why",
          "Name the most expensive item",
          "\"I've never tried anything here.\"",
        ],
        answer: 1,
        why: "A real, personal pick tailored to what they want builds trust, and trust sells.",
      },
      {
        prompt: "What makes an upsell feel helpful instead of pushy?",
        choices: [
          "Repeating the offer until they say yes",
          "Tying it to what the guest already wants, and taking 'no' gracefully",
          "Only offering the priciest option",
          "Upselling every single item",
        ],
        answer: 1,
        why: "Suggestions that fit the guest feel like service. Pressure feels like a sales pitch.",
      },
      {
        prompt: "A guest orders a burger. Which add-on suggestion is the most natural?",
        choices: ["A second burger", "Adding bacon or swapping in the truffle fries", "A bottle of champagne", "A kids' menu item"],
        answer: 1,
        why: "Small add-ons that improve the dish they already chose are the easiest yes.",
      },
      {
        prompt: "Why does upselling matter for your tips?",
        choices: [
          "It doesn't",
          "Tips are usually figured as a percentage of the bill, so a better experience with a bigger check tends to tip more",
          "Managers pay a bonus for every upsell",
          "Guests have to tip on upsells",
        ],
        answer: 1,
        why: "Most guests tip a percentage of the check, so adding things they actually enjoy raises both.",
      },
    ],
  },
  {
    id: "l2-apps-desserts",
    level: 2,
    title: "Apps and desserts",
    summary: "The courses guests skip unless you mention them.",
    questions: [
      {
        prompt: "When is the best time to suggest an appetizer?",
        choices: ["After the entrées arrive", "With the drink order, before guests settle on entrées", "When dropping the check", "Only if the table asks"],
        answer: 1,
        why: "Guests are hungriest and still deciding at the start; that's when apps sell.",
      },
      {
        prompt: "A table says they're too full for dessert. What could you offer?",
        choices: ["Nothing; drop the check", "Something to share with extra spoons, or coffee", "A second entrée", "Insist they try the cake"],
        answer: 1,
        why: "A shared dessert or coffee is a light yes for a table that's 'too full'.",
      },
      {
        prompt: "What helps sell dessert?",
        choices: [
          "Asking \"Any dessert?\" while reaching for the plates",
          "Describing one or two desserts by name with a vivid detail",
          "Leaving the dessert menu on the table without a word",
          "Waiting until they ask",
        ],
        answer: 1,
        why: "A specific, appetizing description beats a generic question.",
      },
      {
        prompt: "A two-top is celebrating an anniversary. What's a thoughtful suggestion?",
        choices: [
          "Nothing special",
          "A dessert to share or a glass of bubbly, if they're interested",
          "The early-bird menu",
          "Splitting the check",
        ],
        answer: 1,
        why: "Celebrations are when guests want to treat themselves; a suggestion that fits the moment is welcome.",
      },
      {
        prompt: "A guest asks if the appetizer portion is big. What's the best answer?",
        choices: [
          "\"Huge!\" to make the sale",
          "An honest answer, like \"it's good for two to share\"",
          "\"I don't know.\"",
          "\"You should get two.\"",
        ],
        answer: 1,
        why: "Honest answers build the trust that makes your next suggestion land.",
      },
    ],
  },
  {
    id: "l2-drinks",
    level: 2,
    title: "Drink upsells",
    summary: "Second rounds, premium swaps and non-alcoholic options.",
    questions: [
      {
        prompt: "A guest orders \"a vodka soda.\" What's a helpful follow-up?",
        choices: [
          "Nothing",
          "\"Any vodka you prefer? We have Tito's and Grey Goose.\"",
          "\"Make it a double?\" every time",
          "\"Are you sure you want that?\"",
        ],
        answer: 1,
        why: "Offering named options lets guests choose a premium spirit without pressure.",
      },
      {
        prompt: "A guest isn't drinking alcohol tonight. What do you offer?",
        choices: [
          "Water only",
          "A mocktail, fresh lemonade or a specialty soda",
          "Nothing; move on",
          "Try to talk them into a cocktail",
        ],
        answer: 1,
        why: "Non-alcoholic specialty drinks are a real sale and make the guest feel included.",
      },
      {
        prompt: "What's the right approach when a guest seems to have had too much to drink?",
        choices: [
          "Keep serving; it's their choice",
          "Follow your house policy, slow or stop service and involve a manager",
          "Serve them doubles so they leave sooner",
          "Ignore it",
        ],
        answer: 1,
        why: "Responsible service follows your house policy and your state's rules; get a manager involved.",
      },
      {
        prompt: "When should you offer a second round?",
        choices: [
          "When drinks are about a third full, before glasses run empty",
          "Only after glasses have been empty for a while",
          "Never; let them ask",
          "Right after the first drinks are served",
        ],
        answer: 0,
        why: "Asking just before glasses are empty feels attentive, not pushy.",
      },
      {
        prompt: "A table orders a bottle of wine. What's a good extra touch?",
        choices: [
          "Pour it and leave the bottle far away",
          "Present the bottle, pour a taste for the host, then pour for the table and keep glasses topped",
          "Let them pour it themselves from the start",
          "Ask if they want a second bottle right away",
        ],
        answer: 1,
        why: "A simple, confident bottle service makes the table feel looked after.",
      },
    ],
  },
  {
    id: "l2-reading",
    level: 2,
    title: "Reading the table",
    summary: "Match your pace and pitch to who's in front of you.",
    questions: [
      {
        prompt: "A business lunch is deep in conversation. How do you serve them?",
        choices: [
          "Chat with them about the menu at length",
          "Be quick and quiet, and keep interruptions short",
          "Interrupt often to check in",
          "Leave them alone entirely",
        ],
        answer: 1,
        why: "Efficient, low-key service fits a table that's there to talk business.",
      },
      {
        prompt: "A family with young kids sits down. What helps most?",
        choices: [
          "Wait to take any order until the adults decide",
          "Offer to put a kids' meal or something quick in first",
          "Recommend the tasting menu",
          "Seat them near the bar",
        ],
        answer: 1,
        why: "Getting food to kids fast makes the whole table's meal go better.",
      },
      {
        prompt: "A guest closes the menu and looks around. What's that signal?",
        choices: ["They're ready to order", "They want the check", "They're leaving", "Nothing"],
        answer: 0,
        why: "A closed menu and a glance around usually means 'we're ready'.",
      },
      {
        prompt: "A table is clearly on a budget. What's the right approach?",
        choices: [
          "Push the priciest items anyway",
          "Suggest good-value favorites and shareables",
          "Give them worse service",
          "Skip suggestions completely",
        ],
        answer: 1,
        why: "Good value suggestions still raise the check and build goodwill.",
      },
      {
        prompt: "A regular comes in. What's an easy way to make them feel welcome?",
        choices: [
          "Treat them like any new guest",
          "Greet them by name and remember their usual order",
          "Skip the greeting since they know the menu",
          "Ask why they keep coming back",
        ],
        answer: 1,
        why: "Remembering regulars is one of the most reliable ways to earn steady tips.",
      },
    ],
  },
];

/**
 * Choices are shuffled with a fixed seed per question so the right answer
 * isn't always in the same spot, and the client and the server grader see
 * the same order.
 */
export const DRILLS: readonly Drill[] = AUTHORED.map((drill) => ({
  ...drill,
  questions: drill.questions.map((q, i) => {
    const order = shuffle(
      q.choices.map((_, j) => j),
      rng(`${drill.id}:${i}`),
    );
    return { ...q, choices: order.map((j) => q.choices[j]), answer: order.indexOf(q.answer) };
  }),
}));

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

export function drillsForLevel(level: LevelId): Drill[] {
  return DRILLS.filter((d) => d.level === level);
}
